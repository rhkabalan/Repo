import type { WebSocket } from 'ws';
import type { ServerMessage } from './protocol.js';

/** Token bucket: `ratePerSecond` sustained, bursts up to `burst`. */
export class TokenBucket {
  private tokens: number;
  private last = Date.now();

  constructor(
    private readonly ratePerSecond: number,
    private readonly burst: number,
  ) {
    this.tokens = burst;
  }

  take(): boolean {
    const now = Date.now();
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.ratePerSecond);
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

/** One authenticated player socket. */
export class Connection {
  readonly limiter = new TokenBucket(60, 120);
  violations = 0;
  alive = true;

  constructor(
    readonly userId: string,
    readonly displayName: string,
    readonly avatarUrl: string | null,
    readonly socket: WebSocket,
  ) {}

  get open() {
    return this.socket.readyState === this.socket.OPEN;
  }

  send(msg: ServerMessage): void {
    if (this.open) this.socket.send(JSON.stringify(msg));
  }

  close(code: number, reason: string): void {
    if (this.open || this.socket.readyState === this.socket.CONNECTING) this.socket.close(code, reason);
  }
}
