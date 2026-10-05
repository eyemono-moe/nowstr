import { describe, expect, it } from "vite-plus/test";
import { normalizeRelayUrl, parseWriteRelays } from "./relay-list";

describe("parseWriteRelays", () => {
  it("marker なし・write の r tag を write relay とする", () => {
    const tags = [
      ["r", "wss://both.example.com"],
      ["r", "wss://write.example.com", "write"],
      ["r", "wss://read.example.com", "read"],
      ["p", "deadbeef"],
    ];
    expect(parseWriteRelays(tags)).toEqual(["wss://both.example.com/", "wss://write.example.com/"]);
  });

  it("不正な URL・ws 以外・重複は除く", () => {
    const tags = [
      ["r", "not a url"],
      ["r", "https://example.com"],
      ["r", "wss://dup.example.com"],
      ["r", "wss://DUP.example.com/"],
      ["r"],
    ];
    expect(parseWriteRelays(tags)).toEqual(["wss://dup.example.com/"]);
  });
});

describe("normalizeRelayUrl", () => {
  it("ws/wss 以外は null", () => {
    expect(normalizeRelayUrl("https://example.com")).toBeNull();
    expect(normalizeRelayUrl("wss://example.com/path")).toBe("wss://example.com/path");
  });
});
