import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { backoffMs, RealtimeConnection, type ConnectionState } from "./connection";

class FakeSocket {
  static instances: FakeSocket[] = [];
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close(code = 1000) {
    this.onclose?.({ code });
  }
  // test helpers
  open() {
    this.onopen?.();
  }
  reply(frame: object) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
  drop(code: number) {
    this.onclose?.({ code });
  }
}

const latest = () => FakeSocket.instances.at(-1)!;
const flush = () => vi.advanceTimersByTimeAsync(0);

function make(getToken = vi.fn(async (): Promise<string | null> => "tok")) {
  const connection = new RealtimeConnection({
    url: "ws://api.test/ws",
    getToken,
    WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
    random: () => 1,
    isOnline: () => true,
  });
  const states: ConnectionState["status"][] = [];
  connection.subscribe((s) => states.push(s.status));
  return { connection, states, getToken };
}

async function connect(connection: RealtimeConnection, expiresInMs = 60_000) {
  connection.start();
  latest().open();
  await flush();
  latest().reply({ type: "auth.ok", expires_at: new Date(Date.now() + expiresInMs).toISOString() });
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
});
afterEach(() => vi.useRealTimers());

describe("RealtimeConnection", () => {
  it("sends the token in the first frame, not the URL, then reports connected", async () => {
    const { connection, states } = make();
    await connect(connection);
    expect(latest().url).toBe("ws://api.test/ws/");
    expect(latest().sent[0]).toEqual({ type: "auth", token: "tok" });
    expect(states).toEqual(["connecting", "connected"]);
    expect(connection.send({ type: "ping" })).toBe(true);
  });

  it("refreshes the token before it expires", async () => {
    const { connection, getToken } = make();
    await connect(connection, 60_000);
    await vi.advanceTimersByTimeAsync(46_000);
    expect(latest().sent.at(-1)).toEqual({ type: "auth.refresh", token: "tok" });
    expect(getToken).toHaveBeenLastCalledWith({ fresh: true });
  });

  it("reconnects with backoff after a dropped connection", async () => {
    const { connection, states } = make();
    await connect(connection);
    latest().drop(1006);
    expect(states.at(-1)).toBe("reconnecting");
    expect(connection.send({ type: "ping" })).toBe(false);
    expect(FakeSocket.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(backoffMs(1, () => 1));
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it("stops for good when the server says not allowed (4403)", async () => {
    const { connection } = make();
    await connect(connection);
    latest().drop(4403);
    expect(connection.getState()).toMatchObject({ status: "offline" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("gives up after repeated 4401s and asks to sign in again", async () => {
    const { connection } = make();
    connection.start();
    for (let i = 0; i < 4; i++) {
      latest().open();
      await flush();
      latest().drop(4401);
      await vi.advanceTimersByTimeAsync(30_000);
    }
    expect(connection.getState()).toEqual({ status: "offline", reason: expect.stringMatching(/Sign in again/) });
  });

  it("goes offline without a token instead of connecting anonymously", async () => {
    const { connection } = make(vi.fn(async () => null));
    connection.start();
    latest().open();
    await flush();
    expect(latest().sent).toEqual([]);
    expect(connection.getState()).toMatchObject({ status: "offline" });
  });

  it("passes other frames to listeners for that type", async () => {
    const { connection } = make();
    const listener = vi.fn();
    connection.on("realtime.test", listener);
    await connect(connection);
    latest().reply({ type: "realtime.test", n: 1 });
    expect(listener).toHaveBeenCalledWith({ type: "realtime.test", n: 1 });
  });

  it("caps backoff at 30 seconds", () => {
    expect(backoffMs(1, () => 1)).toBe(1000);
    expect(backoffMs(3, () => 1)).toBe(4000);
    expect(backoffMs(20, () => 1)).toBe(30_000);
    expect(backoffMs(20, () => 0)).toBe(15_000);
  });
});
