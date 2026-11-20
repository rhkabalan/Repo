/** WebSocket client for the real-time protocol (see backend/docs/REALTIME.md). */
import type { Api } from './api';

export type ServerMsg = { t: string; [k: string]: any };
type Handler = (msg: ServerMsg) => void;

export class Realtime {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private seq = 0;
  private closedByUser = false;
  private retry = 0;
  userId = '';
  connected = false;

  constructor(private readonly api: Api) {}

  on(h: Handler) {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }

  /** Connect and authenticate; resolves on `welcome`. Reconnects automatically with backoff. */
  connect(): Promise<void> {
    this.closedByUser = false;
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.api.realtimeUrl);
      this.ws = ws;
      ws.onopen = () => ws.send(JSON.stringify({ t: 'auth', token: this.api.accessToken }));
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data as string) as ServerMsg;
        if (msg.t === 'welcome') {
          this.userId = msg.userId;
          this.connected = true;
          this.retry = 0;
          resolve();
        }
        for (const h of this.handlers) h(msg);
      };
      ws.onclose = async (e) => {
        const wasConnected = this.connected;
        this.connected = false;
        if (!wasConnected) reject(new Error(`socket closed (${e.code})`));
        if (this.closedByUser || e.code === 4000) return;
        if (e.code === 4001) await this.api.refresh();
        const delay = Math.min(10_000, 500 * 2 ** this.retry++);
        setTimeout(() => void this.connect().catch(() => undefined), delay);
      };
    });
  }

  send(msg: object) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  input(data: object) {
    this.send({ t: 'input', seq: ++this.seq, data });
  }

  close() {
    this.closedByUser = true;
    this.ws?.close();
  }
}
