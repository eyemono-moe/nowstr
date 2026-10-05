import { verifier } from "@rx-nostr/crypto";
import type { EventTemplate } from "./core/nip38";
import { AppError } from "./lib/errors";
import type { NostrSigner, SignedEvent } from "./nostr/signer";

/** 署名拡張の確認ダイアログで待たされることがあるので長めにする */
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * 音楽サービスのタブにある NIP-07（window.nostr）で署名する NostrSigner。
 * service worker からは window.nostr を使えないため、"player" ポートの先の content script → main-world.js に中継してもらう。
 *
 * 返ってくる値はページ側のスクリプトでも偽造できるので、そのまま信用しない。
 * 公開鍵は形式を、署名済みイベントは verifySignedEvent() で中身と署名を検証してから使うこと。
 */
export class TabSigner implements NostrSigner {
  private readonly pending = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: unknown) => void }
  >();

  private readonly port: chrome.runtime.Port;

  constructor(port: chrome.runtime.Port) {
    this.port = port;
  }

  /** "player" ポートに届いた nip07-result を渡す */
  handleResult(message: { id: string; result?: unknown; error?: string }): void {
    const request = this.pending.get(message.id);
    if (!request) return;
    this.pending.delete(message.id);
    if (message.error === undefined) {
      request.resolve(message.result);
    } else if (message.error === "unavailable") {
      request.reject(
        new AppError(
          "nip07_unavailable",
          "音楽サービスのタブで NIP-07 対応のブラウザ拡張（nos2x, Alby など）が見つかりません。",
        ),
      );
    } else {
      request.reject(
        new AppError("nip07_rejected", `NIP-07 拡張で署名が拒否されました: ${message.error}`),
      );
    }
  }

  /** タブが閉じられたときに、待っている要求を失敗させる */
  dispose(): void {
    for (const request of this.pending.values()) {
      request.reject(new AppError("nip07_unavailable", "署名を頼んだタブが閉じられました。"));
    }
    this.pending.clear();
  }

  async getPublicKey(): Promise<string> {
    const pubkey = await this.request("getPublicKey");
    if (typeof pubkey !== "string" || !/^[0-9a-f]{64}$/.test(pubkey)) {
      throw new AppError("nip07_rejected", "NIP-07 拡張から公開鍵を取得できませんでした。");
    }
    return pubkey;
  }

  async signEvent(event: EventTemplate): Promise<SignedEvent> {
    return (await this.request("signEvent", event)) as SignedEvent;
  }

  private request(method: "getPublicKey" | "signEvent", params?: unknown): Promise<unknown> {
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new AppError("nip07_rejected", "NIP-07 拡張からの応答がありませんでした。"));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      try {
        this.port.postMessage({ type: "nip07", id, method, params });
      } catch (error) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(
          new AppError("nip07_unavailable", "署名を頼むタブに接続できません。", { cause: error }),
        );
      }
    });
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * タブから返ってきた署名済みイベントが、頼んだ内容そのものに、期待した公開鍵で正しく署名されたものか。
 * ページ側のスクリプトが別の内容に差し替えたり、壊れた値を返したりしていないことを確かめる。
 */
export const verifySignedEvent = async (
  value: unknown,
  template: EventTemplate,
  pubkey: string,
): Promise<SignedEvent> => {
  const fail = () => {
    throw new AppError("nip07_rejected", "NIP-07 拡張から正しい署名が返ってきませんでした。");
  };
  if (!isRecord(value)) return fail();
  const { id, sig, kind, created_at, content, tags } = value;
  if (
    typeof id !== "string" ||
    typeof sig !== "string" ||
    kind !== template.kind ||
    created_at !== template.created_at ||
    content !== template.content ||
    JSON.stringify(tags) !== JSON.stringify(template.tags)
  ) {
    return fail();
  }
  if (value.pubkey !== pubkey) {
    throw new AppError(
      "nip07_rejected",
      "NIP-07 拡張の公開鍵が変わりました。拡張のポップアップで、投稿を一度オフにしてからオンにし直してください。",
    );
  }
  const event: SignedEvent = { ...template, id, pubkey, sig };
  if (!(await verifier(event))) return fail();
  return event;
};
