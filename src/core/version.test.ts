import { describe, expect, it } from "vite-plus/test";
import { isOlderVersion } from "./version";

describe("isOlderVersion", () => {
  it("各桁を数として比べる", () => {
    expect(isOlderVersion("0.1.3", "0.1.4")).toBe(true);
    expect(isOlderVersion("0.1.9", "0.1.10")).toBe(true);
    expect(isOlderVersion("0.9.0", "1.0.0")).toBe(true);
  });

  it("同じか新しければ古くない（開発中の拡張など）", () => {
    expect(isOlderVersion("0.1.4", "0.1.4")).toBe(false);
    expect(isOlderVersion("0.1.5", "0.1.4")).toBe(false);
    expect(isOlderVersion("0.2", "0.1.4")).toBe(false);
  });

  it("足りない桁は 0 とみなす", () => {
    expect(isOlderVersion("0.1", "0.1.0")).toBe(false);
    expect(isOlderVersion("0.1", "0.1.1")).toBe(true);
  });

  it("読めない値なら古いとはみなさない", () => {
    expect(isOlderVersion("", "0.1.4")).toBe(false);
    expect(isOlderVersion("dev", "0.1.4")).toBe(false);
  });
});
