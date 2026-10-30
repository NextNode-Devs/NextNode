/**
 * The browser side of the authenticated socket (#1), per
 * docs/proposals/realtime-messaging.md. Framework-free so it can be tested
 * with a fake WebSocket; React code uses `RealtimeProvider` / `useRealtime`.
 *
 * - The Clerk token goes in the first frame, never the URL.
 * - It is refreshed (`auth.refresh`) before `expires_at`.
 * - Dropped connections retry with backoff (1 s → 30 s, jittered).
 * - Close codes: 4401 → fresh token and retry; 4403 → stop, not allowed;
 *   4429 / 1009 → retry later, too many / too large frames.
 */

export type ConnectionState =
  | { status: "connecting" }
  | { status: "connected" }
  | { status: "reconnecting"; attempt: number; reason?: string }
  | { status: "offline"; reason: string };

export type Frame = { type: string; [key: string]: unknown };

type GetToken = (options: { fresh: boolean }) => Promise<string | null>;

export type ConnectionOptions = {
  url: string;
  getToken: GetToken;
  /** Injected in tests. */
  WebSocketImpl?: typeof WebSocket;
  random?: () => number;
  isOnline?: () => boolean;
};

export const CLOSE = { UNAUTHENTICATED: 4401, FORBIDDEN: 4403, RATE_LIMITED: 4429, TOO_LARGE: 1009 } as const;
const MAX_AUTH_FAILURES = 3;
const REFRESH_AHEAD_MS = 15_000;

export function backoffMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(30_000, 1000 * 2 ** Math.max(0, attempt - 1));
  return Math.round(base * (0.5 + random() / 2));
}

export class RealtimeConnection {
  private socket: WebSocket | null = null;
  private state: ConnectionState = { status: "connecting" };
  private stateListeners = new Set<(state: ConnectionState) => void>();
  private frameListeners = new Map<string, Set<(frame: Frame) => void>>();
  private attempt = 0;
  private authFailures = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private readonly WS: typeof WebSocket;
  private readonly random: () => number;
  private readonly isOnline: () => boolean;

  constructor(private readonly options: ConnectionOptions) {
    this.WS = options.WebSocketImpl ?? WebSocket;
    this.random = options.random ?? Math.random;
    this.isOnline = options.isOnline ?? (() => (typeof navigator === "undefined" ? true : navigator.onLine));
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.onOnline);
      window.addEventListener("offline", this.onOffline);
    }
    this.open();
  }

  stop(): void {
    this.stopped = true;
    this.clearTimers();
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.onOnline);
      window.removeEventListener("offline", this.onOffline);
    }
    this.socket?.close(1000);
    this.socket = null;
  }

  getState(): ConnectionState {
    return this.state;
  }

  /** Listen to connection state; returns an unsubscribe function. */
  subscribe(listener: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /** Listen to frames of one type (e.g. #4's `message.new`); returns an unsubscribe function. */
  on(type: string, listener: (frame: Frame) => void): () => void {
    const listeners = this.frameListeners.get(type) ?? new Set();
    listeners.add(listener);
    this.frameListeners.set(type, listeners);
    return () => listeners.delete(listener);
  }

  /** Sends a frame if connected; returns false otherwise so callers can disable their UI. */
  send(frame: Frame): boolean {
    if (this.state.status !== "connected" || !this.socket) return false;
    this.socket.send(JSON.stringify(frame));
    return true;
  }

  private setState(next: ConnectionState): void {
    this.state = next;
    for (const listener of this.stateListeners) listener(next);
  }

  private open(): void {
    if (this.stopped) return;
    if (!this.isOnline()) {
      this.setState({ status: "offline", reason: "You're offline. We'll reconnect when you're back." });
      return;
    }
    this.setState(this.attempt === 0 ? { status: "connecting" } : { status: "reconnecting", attempt: this.attempt });
    const socket = new this.WS(`${this.options.url}/`);
    this.socket = socket;
    socket.onopen = () => void this.authenticate(socket, "auth", this.authFailures > 0);
    socket.onmessage = (event) => this.receive(socket, event.data);
    socket.onclose = (event) => this.closed(socket, event.code);
  }

  private async authenticate(socket: WebSocket, type: "auth" | "auth.refresh", fresh: boolean): Promise<void> {
    const token = await this.options.getToken({ fresh }).catch(() => null);
    if (socket !== this.socket) return;
    if (!token) {
      this.stopped = true;
      socket.close(1000);
      this.setState({ status: "offline", reason: "Sign in again to reconnect." });
      return;
    }
    socket.send(JSON.stringify({ type, token }));
  }

  private receive(socket: WebSocket, data: unknown): void {
    let frame: Frame;
    try {
      frame = JSON.parse(String(data)) as Frame;
    } catch {
      return;
    }
    if (frame.type === "auth.ok") {
      this.attempt = 0;
      this.authFailures = 0;
      this.setState({ status: "connected" });
      this.scheduleRefresh(socket, String(frame.expires_at ?? ""));
      return;
    }
    for (const listener of this.frameListeners.get(frame.type) ?? []) listener(frame);
  }

  private scheduleRefresh(socket: WebSocket, expiresAt: string): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    const expires = Date.parse(expiresAt);
    if (Number.isNaN(expires)) return;
    const delay = Math.max(1000, expires - Date.now() - REFRESH_AHEAD_MS);
    this.refreshTimer = setTimeout(() => void this.authenticate(socket, "auth.refresh", true), delay);
  }

  private closed(socket: WebSocket, code: number): void {
    if (socket !== this.socket) return;
    this.socket = null;
    this.clearTimers();
    if (this.stopped) return;

    if (code === CLOSE.FORBIDDEN) {
      this.stopped = true;
      this.setState({ status: "offline", reason: "This account can't use live updates. Finish onboarding first." });
      return;
    }
    if (code === CLOSE.UNAUTHENTICATED && ++this.authFailures > MAX_AUTH_FAILURES) {
      this.stopped = true;
      this.setState({ status: "offline", reason: "Your session couldn't be verified. Sign in again." });
      return;
    }
    const reason =
      code === CLOSE.RATE_LIMITED
        ? "Too many messages at once. Reconnecting shortly."
        : code === CLOSE.TOO_LARGE
          ? "A message was too large. Reconnecting."
          : undefined;
    this.attempt += 1;
    this.setState({ status: "reconnecting", attempt: this.attempt, reason });
    this.retryTimer = setTimeout(() => this.open(), backoffMs(this.attempt, this.random));
  }

  private clearTimers(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.retryTimer = this.refreshTimer = null;
  }

  private onOnline = () => {
    if (this.stopped || this.socket) return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.open();
  };

  private onOffline = () => {
    if (this.stopped) return;
    this.setState({ status: "offline", reason: "You're offline. We'll reconnect when you're back." });
  };
}
