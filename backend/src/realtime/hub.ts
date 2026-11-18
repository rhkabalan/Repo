import type { FastifyBaseLogger, FastifyRequest } from 'fastify';
import type { RawData, WebSocket } from 'ws';
import type { TokenService } from '../auth/tokens.js';
import type { Db } from '../db/pool.js';
import type { GameRegistry } from '../games/registry.js';
import { AppError } from '../lib/errors.js';
import { getUser } from '../users/service.js';
import { Connection } from './connection.js';
import type { Matchmaker } from './matchmaker.js';
import { CloseCode, PROTOCOL_VERSION, clientMessageSchema, type ClientMessage } from './protocol.js';
import type { RoomManager } from './rooms.js';

const AUTH_TIMEOUT_MS = 5_000;
const HEARTBEAT_MS = 15_000;
const MAX_VIOLATIONS = 20;

/** Accepts WebSocket connections, authenticates them and routes protocol messages. */
export class RealtimeHub {
  private readonly connections = new Map<string, Connection>();
  private readonly heartbeat: NodeJS.Timeout;

  constructor(
    private readonly db: Db,
    private readonly tokens: TokenService,
    private readonly games: GameRegistry,
    private readonly rooms: RoomManager,
    private readonly matchmaker: Matchmaker,
    private readonly log: FastifyBaseLogger,
  ) {
    this.heartbeat = setInterval(() => {
      for (const conn of this.connections.values()) {
        if (!conn.alive) {
          conn.socket.terminate();
          continue;
        }
        conn.alive = false;
        conn.socket.ping();
      }
    }, HEARTBEAT_MS);
    this.heartbeat.unref();
  }

  get onlineCount() {
    return this.connections.size;
  }

  handle(socket: WebSocket, req: FastifyRequest): void {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      void this.authenticate(socket, header.slice(7));
      return;
    }
    // No header: the first frame must be {"t":"auth","token":"..."}.
    const timeout = setTimeout(() => socket.close(CloseCode.AuthTimeout, 'auth timeout'), AUTH_TIMEOUT_MS);
    socket.once('message', (raw) => {
      clearTimeout(timeout);
      const msg = this.decode(raw);
      if (msg?.t !== 'auth') {
        socket.close(CloseCode.AuthFailed, 'first message must be auth');
        return;
      }
      void this.authenticate(socket, msg.token);
    });
  }

  private decode(raw: RawData): ClientMessage | null {
    try {
      const result = clientMessageSchema.safeParse(JSON.parse(raw.toString()));
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }

  private async authenticate(socket: WebSocket, token: string) {
    let conn: Connection;
    try {
      const claims = await this.tokens.verifyAccess(token);
      const user = await getUser(this.db, claims.userId);
      conn = new Connection(user.id, user.displayName, user.avatarUrl, socket);
    } catch {
      socket.close(CloseCode.AuthFailed, 'authentication failed');
      return;
    }
    if (socket.readyState !== socket.OPEN) return;

    // One live socket per player: a new login (another device / reconnect) replaces the old.
    const previous = this.connections.get(conn.userId);
    if (previous) {
      this.connections.delete(conn.userId);
      previous.close(CloseCode.Replaced, 'connected from another session');
    }
    this.connections.set(conn.userId, conn);

    socket.on('pong', () => (conn.alive = true));
    socket.on('message', (raw) => this.onMessage(conn, raw));
    socket.on('close', () => this.onClose(conn));
    socket.on('error', (err) => this.log.debug({ err, userId: conn.userId }, 'socket error'));

    conn.send({ t: 'welcome', userId: conn.userId, serverTime: Date.now(), protocolVersion: PROTOCOL_VERSION });
    this.rooms.roomOf(conn.userId)?.reattach(conn);
  }

  private onClose(conn: Connection) {
    if (this.connections.get(conn.userId) === conn) {
      this.connections.delete(conn.userId);
      this.matchmaker.leave(conn.userId);
    }
    this.rooms.roomOf(conn.userId)?.disconnected(conn);
  }

  private error(conn: Connection, code: string, message: string) {
    conn.violations++;
    conn.send({ t: 'error', code, message });
  }

  private onMessage(conn: Connection, raw: RawData) {
    if (!conn.limiter.take()) {
      conn.violations++;
      if (conn.violations > MAX_VIOLATIONS) conn.close(CloseCode.RateLimited, 'rate limited');
      return;
    }
    const msg = this.decode(raw);
    if (!msg) return this.error(conn, 'bad_message', 'Malformed or unknown message');
    try {
      this.dispatch(conn, msg);
    } catch (err) {
      if (err instanceof AppError) return this.error(conn, err.code, err.message);
      this.log.error({ err, userId: conn.userId, t: msg.t }, 'realtime handler failed');
      this.error(conn, 'internal', 'Internal error');
    }
  }

  /** Leave a room that's already over so the player can start something new. */
  private busyRoom(userId: string) {
    const room = this.rooms.roomOf(userId);
    if (room?.phase === 'finished') {
      room.leave(userId, 'left');
      return undefined;
    }
    return room;
  }

  private dispatch(conn: Connection, msg: ClientMessage) {
    switch (msg.t) {
      case 'auth':
        return; // already authenticated
      case 'ping':
        return conn.send({ t: 'pong', ts: msg.ts, serverTime: Date.now() });

      case 'queue.join': {
        if (this.busyRoom(conn.userId)) return this.error(conn, 'in_room', 'Leave your current room first');
        const game = this.games.get(msg.gameId);
        if (!game.modes.includes('multiplayer')) return this.error(conn, 'bad_mode', 'Game has no multiplayer');
        const position = this.matchmaker.join(conn, game.id);
        return conn.send({ t: 'queue.joined', gameId: game.id, position });
      }
      case 'queue.leave':
        this.matchmaker.leave(conn.userId);
        return conn.send({ t: 'queue.left' });

      case 'room.create': {
        if (this.busyRoom(conn.userId)) return this.error(conn, 'in_room', 'Leave your current room first');
        const game = this.games.get(msg.gameId);
        if (!game.modes.includes(msg.mode)) return this.error(conn, 'bad_mode', `Game has no ${msg.mode} mode`);
        this.matchmaker.leave(conn.userId);
        const room = this.rooms.create(game, msg.mode, msg.mode === 'multiplayer');
        this.rooms.addPlayer(room, conn);
        if (msg.mode === 'solo') room.start();
        return;
      }
      case 'room.join': {
        if (this.busyRoom(conn.userId)) return this.error(conn, 'in_room', 'Leave your current room first');
        const room = this.rooms.byInviteCode(msg.code);
        if (!room || room.isDisposed) return this.error(conn, 'room_not_found', 'No room with that code');
        if (room.phase !== 'lobby') return this.error(conn, 'room_started', 'That game has already started');
        if (room.isFull) return this.error(conn, 'room_full', 'That room is full');
        this.matchmaker.leave(conn.userId);
        this.rooms.addPlayer(room, conn);
        return;
      }
      case 'room.ready': {
        this.rooms.roomOf(conn.userId)?.setReady(conn.userId, msg.ready);
        return;
      }
      case 'room.start': {
        const room = this.rooms.roomOf(conn.userId);
        if (!room) return this.error(conn, 'not_in_room', 'You are not in a room');
        if (room.hostId !== conn.userId) return this.error(conn, 'not_host', 'Only the host can start');
        const problem = room.canStart();
        if (problem) return this.error(conn, 'cannot_start', problem);
        room.start();
        return;
      }
      case 'room.leave': {
        this.rooms.roomOf(conn.userId)?.leave(conn.userId, 'left');
        return;
      }
      case 'input': {
        const room = this.rooms.roomOf(conn.userId);
        if (!room) return this.error(conn, 'not_in_room', 'You are not in a room');
        const problem = room.queueInput(conn.userId, msg.seq, msg.data);
        if (problem) this.error(conn, 'bad_input', problem);
        return;
      }
      case 'chat': {
        const room = this.rooms.roomOf(conn.userId);
        if (!room) return this.error(conn, 'not_in_room', 'You are not in a room');
        room.broadcast({
          t: 'chat',
          from: conn.userId,
          displayName: conn.displayName,
          text: msg.text,
          serverTime: Date.now(),
        });
        return;
      }
    }
  }

  shutdown(): void {
    clearInterval(this.heartbeat);
    for (const conn of this.connections.values()) conn.close(CloseCode.ServerShutdown, 'server shutting down');
    this.connections.clear();
  }
}
