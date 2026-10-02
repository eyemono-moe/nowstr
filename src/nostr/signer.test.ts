import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { waitForNip07 } from "./signer";

const fakeNip07 = { getPublicKey: async () => "", signEvent: async () => ({}) };

describe("waitForNip07", () => {
  let win: { nostr?: unknown };
  beforeEach(() => {
    vi.useFakeTimers();
    win = {};
    vi.stubGlobal("window", win);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("後から注入された window.nostr を検出する", async () => {
    const result = waitForNip07(3_000);
    await vi.advanceTimersByTimeAsync(1_200);
    win.nostr = fakeNip07;
    await vi.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBe(true);
  });

  it("タイムアウトまでに現れなければ false", async () => {
    const result = waitForNip07(1_000);
    await vi.advanceTimersByTimeAsync(1_100);
    await expect(result).resolves.toBe(false);
  });

  it("NIP-07 の形をしていない window.nostr は無視する", async () => {
    win.nostr = { foo: 1 };
    const result = waitForNip07(500);
    await vi.advanceTimersByTimeAsync(600);
    await expect(result).resolves.toBe(false);
  });
});
