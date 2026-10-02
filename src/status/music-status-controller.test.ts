import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { EventTemplate } from "../core/nip38";
import type { PlaybackState, Track } from "../core/playback";
import { MusicStatusController } from "./music-status-controller";

const trackA: Track = {
  uri: "spotify:track:a",
  title: "A",
  artists: ["X"],
  album: "Al",
  artworkUrl: null,
  durationMs: 200_000,
};
const trackB: Track = { ...trackA, uri: "spotify:track:b", title: "B" };

const state = (overrides: Partial<PlaybackState> = {}): PlaybackState => ({
  track: trackA,
  paused: false,
  positionMs: 0,
  durationMs: 200_000,
  updatedAt: Date.now(),
  ...overrides,
});

describe("MusicStatusController", () => {
  let sent: EventTemplate[];
  let send: (event: EventTemplate) => Promise<void>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    sent = [];
    send = vi.fn(async (event: EventTemplate) => {
      sent.push(event);
    });
  });
  afterEach(() => vi.useRealTimers());

  const create = () => new MusicStatusController({ send, onChange: () => {}, debounceMs: 500 });

  it("再生開始で publish し、位置が進んだだけでは再投稿しない", async () => {
    const controller = create();
    controller.update(state());
    await vi.advanceTimersByTimeAsync(500);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.content).toBe("A - X");

    vi.advanceTimersByTime(5_000);
    controller.update(state({ positionMs: 5_000 }));
    await vi.advanceTimersByTimeAsync(500);
    expect(sent).toHaveLength(1);
  });

  it("連続した曲送りはまとめて最後の曲だけ publish する", async () => {
    const controller = create();
    controller.update(state());
    controller.update(state({ track: trackB }));
    await vi.advanceTimersByTimeAsync(500);
    expect(sent.map((event) => event.content)).toEqual(["B - X"]);
  });

  it("pause で clear、resume で再 publish する", async () => {
    const controller = create();
    controller.update(state());
    await vi.advanceTimersByTimeAsync(500);
    controller.update(state({ paused: true }));
    await vi.advanceTimersByTimeAsync(500);
    controller.update(state());
    await vi.advanceTimersByTimeAsync(500);
    expect(sent.map((event) => event.content)).toEqual(["A - X", "", "A - X"]);
  });

  it("created_at は単調増加させる（同一秒の publish → clear でも後勝ちにする）", async () => {
    const controller = create();
    controller.update(state());
    await vi.advanceTimersByTimeAsync(500);
    await controller.clearNow();
    expect(sent).toHaveLength(2);
    expect(sent[1]!.created_at).toBeGreaterThan(sent[0]!.created_at);
  });

  it("送信中の変更は送信完了後に反映する", async () => {
    let release!: () => void;
    send = vi.fn(async (event: EventTemplate) => {
      sent.push(event);
      if (sent.length === 1) await new Promise<void>((resolve) => (release = resolve));
    });
    const controller = create();
    controller.update(state());
    await vi.advanceTimersByTimeAsync(500);
    controller.update(state({ track: trackB }));
    await vi.advanceTimersByTimeAsync(500);
    expect(sent).toHaveLength(1);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(sent.map((event) => event.content)).toEqual(["A - X", "B - X"]);
  });

  it("送信失敗しても同じ status を再送し続けない", async () => {
    send = vi.fn(async () => {
      throw new Error("boom");
    });
    const onChange = vi.fn();
    const controller = new MusicStatusController({ send, onChange, debounceMs: 500 });
    controller.update(state());
    await vi.advanceTimersByTimeAsync(500);
    controller.update(state({ positionMs: 1_000 }));
    await vi.advanceTimersByTimeAsync(500);
    expect(send).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ phase: "error" }));
  });

  it("未投稿なら clearNow は何も送らない", async () => {
    await create().clearNow();
    expect(sent).toHaveLength(0);
  });
});
