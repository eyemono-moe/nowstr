import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { EventTemplate } from "../core/nip38";
import type { PlaybackState, Track } from "../core/playback";
import { MusicStatusController } from "./music-status-controller";

const trackA: Track = {
  source: "spotify",
  uri: "https://open.spotify.com/track/a",
  title: "A",
  artists: ["X"],
  album: "Al",
  artworkUrl: null,
  durationMs: 200_000,
};
const trackB: Track = { ...trackA, uri: "https://open.spotify.com/track/b", title: "B" };

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

  describe("タブを閉じたとき用の消去イベント", () => {
    const createWithUnload = () => {
      const prepared: (EventTemplate | null)[] = [];
      const controller = new MusicStatusController({
        send,
        onChange: () => {},
        debounceMs: 500,
        prepareUnloadClear: async (event) => {
          prepared.push(event);
        },
      });
      return { controller, prepared };
    };

    it("publish 成功後に、publish より新しい created_at の clear を用意する", async () => {
      const { controller, prepared } = createWithUnload();
      controller.update(state());
      await vi.advanceTimersByTimeAsync(500);
      expect(prepared).toHaveLength(1);
      expect(prepared[0]?.content).toBe("");
      expect(prepared[0]!.created_at).toBe(sent[0]!.created_at + 1);
    });

    it("用意した clear より後の送信は、さらに新しい created_at を使う", async () => {
      const { controller, prepared } = createWithUnload();
      controller.update(state());
      await vi.advanceTimersByTimeAsync(500);
      controller.update(state({ track: trackB }));
      await vi.advanceTimersByTimeAsync(500);
      expect(sent[1]!.created_at).toBeGreaterThan(prepared[0]!.created_at);
      expect(prepared[1]!.created_at).toBe(sent[1]!.created_at + 1);
    });

    it("clear したら用意していた消去イベントを破棄する", async () => {
      const { controller, prepared } = createWithUnload();
      controller.update(state());
      await vi.advanceTimersByTimeAsync(500);
      controller.update(state({ paused: true }));
      await vi.advanceTimersByTimeAsync(500);
      expect(prepared.at(-1)).toBeNull();
    });

    it("publish に失敗したときは用意しない", async () => {
      send = vi.fn(async () => {
        throw new Error("boom");
      });
      const { controller, prepared } = createWithUnload();
      controller.update(state());
      await vi.advanceTimersByTimeAsync(500);
      expect(prepared).toEqual([null]);
    });

    it("用意に失敗しても status の送信は続ける", async () => {
      const controller = new MusicStatusController({
        send,
        onChange: () => {},
        debounceMs: 500,
        prepareUnloadClear: async () => {
          throw new Error("rejected");
        },
      });
      controller.update(state());
      await vi.advanceTimersByTimeAsync(500);
      controller.update(state({ track: trackB }));
      await vi.advanceTimersByTimeAsync(500);
      expect(sent.map((event) => event.content)).toEqual(["A - X", "B - X"]);
    });
  });

  describe("restore", () => {
    const published = {
      trackUri: "https://open.spotify.com/track/a",
      url: "https://open.spotify.com/track/a",
      content: "A - X",
      expiresAt: Math.ceil((1_700_000_000_000 + 200_000) / 1000),
    };

    it("掲示済みの status を引き継ぎ、同じ曲なら再投稿しない", async () => {
      const controller = new MusicStatusController({
        send,
        onChange: () => {},
        debounceMs: 500,
        restore: { status: published, lastCreatedAt: 1_700_000_000 },
      });
      controller.update(state());
      await vi.advanceTimersByTimeAsync(500);
      expect(sent).toEqual([]);
    });

    it("引き継いだ status は、再生が止まっていれば clear する", async () => {
      const controller = new MusicStatusController({
        send,
        onChange: () => {},
        debounceMs: 500,
        restore: { status: published, lastCreatedAt: 1_700_000_000 },
      });
      controller.update(null);
      await vi.advanceTimersByTimeAsync(500);
      expect(sent.map((event) => event.content)).toEqual([""]);
    });

    it("created_at は引き継いだ値より必ず新しくする", async () => {
      const controller = new MusicStatusController({
        send,
        onChange: () => {},
        debounceMs: 500,
        restore: { status: null, lastCreatedAt: 1_700_000_100 },
      });
      controller.update(state());
      await vi.advanceTimersByTimeAsync(500);
      expect(sent[0]!.created_at).toBe(1_700_000_101);
      expect(controller.createdAtCursor).toBe(1_700_000_101);
    });
  });
});
