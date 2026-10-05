import { seckeySigner } from "@rx-nostr/crypto";
import { describe, expect, it, vi } from "vite-plus/test";
import { buildMusicStatusEvent } from "./core/nip38";
import { TabSigner, verifySignedEvent } from "./tab-signer";

const SECKEY = "1".repeat(64);
const signer = seckeySigner(SECKEY);

const template = buildMusicStatusEvent(
  {
    trackUri: "https://music.youtube.com/watch?v=abc",
    url: "https://music.youtube.com/watch?v=abc",
    content: "Intergalactic - Beastie Boys",
    expiresAt: 1_700_000_230,
  },
  1_700_000_000,
);

const sign = async (event = template) => {
  const signed = await signer.signEvent(event);
  return { signed, pubkey: await signer.getPublicKey() };
};

describe("verifySignedEvent", () => {
  it("頼んだ内容に正しく署名されたイベントを受け付ける", async () => {
    const { signed, pubkey } = await sign();
    await expect(verifySignedEvent(signed, template, pubkey)).resolves.toMatchObject({
      id: signed.id,
      content: template.content,
    });
  });

  it("内容を差し替えたイベントは、署名が正しくても拒否する", async () => {
    const { signed, pubkey } = await sign({ ...template, content: "Rick Astley - Never Gonna" });
    await expect(verifySignedEvent(signed, template, pubkey)).rejects.toThrow();
  });

  it("署名が壊れているイベントを拒否する", async () => {
    const { signed, pubkey } = await sign();
    await expect(
      verifySignedEvent({ ...signed, sig: "0".repeat(128) }, template, pubkey),
    ).rejects.toThrow();
  });

  it("別の公開鍵で署名されたイベントを拒否する", async () => {
    const { signed } = await sign();
    await expect(verifySignedEvent(signed, template, "2".repeat(64))).rejects.toThrow(
      "公開鍵が変わりました",
    );
  });

  it("イベントでない値を拒否する", async () => {
    await expect(verifySignedEvent("signed!", template, "2".repeat(64))).rejects.toThrow();
  });
});

describe("TabSigner", () => {
  const fakePort = () => {
    const sent: { id: string; method: string; params?: unknown }[] = [];
    const port = { postMessage: vi.fn((message) => sent.push(message)) };
    return { port: port as unknown as chrome.runtime.Port, sent };
  };

  it("タブに依頼し、返ってきた結果で解決する", async () => {
    const { port, sent } = fakePort();
    const tab = new TabSigner(port);
    const result = tab.getPublicKey();
    expect(sent[0]).toMatchObject({ type: "nip07", method: "getPublicKey" });
    tab.handleResult({ id: sent[0]!.id, result: "a".repeat(64) });
    await expect(result).resolves.toBe("a".repeat(64));
  });

  it("公開鍵の形をしていない値は拒否する", async () => {
    const { port, sent } = fakePort();
    const tab = new TabSigner(port);
    const result = tab.getPublicKey();
    tab.handleResult({ id: sent[0]!.id, result: "npub1..." });
    await expect(result).rejects.toThrow();
  });

  it("NIP-07 拡張がないタブでは nip07_unavailable にする", async () => {
    const { port, sent } = fakePort();
    const tab = new TabSigner(port);
    const result = tab.signEvent(template);
    tab.handleResult({ id: sent[0]!.id, error: "unavailable" });
    await expect(result).rejects.toMatchObject({ code: "nip07_unavailable" });
  });

  it("タブが閉じられたら待っている依頼を失敗させる", async () => {
    const { port } = fakePort();
    const tab = new TabSigner(port);
    const result = tab.signEvent(template);
    tab.dispose();
    await expect(result).rejects.toMatchObject({ code: "nip07_unavailable" });
  });
});
