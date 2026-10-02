import type { EventTemplate } from "../core/nip38";
import { AppError } from "../lib/errors";

export type SignedEvent = EventTemplate & { id: string; pubkey: string; sig: string };

/**
 * Nostr の署名処理の抽象。初期版は NIP-07 のみだが、NIP-46 等へ差し替えられるようにする。
 * Nowstr は秘密鍵を保持しない。
 */
export interface NostrSigner {
  getPublicKey(): Promise<string>;
  signEvent(event: EventTemplate): Promise<SignedEvent>;
}

type Nip07 = {
  getPublicKey(): Promise<string>;
  signEvent(event: EventTemplate): Promise<SignedEvent>;
};

const isNip07 = (value: unknown): value is Nip07 =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Partial<Nip07>).getPublicKey === "function" &&
  typeof (value as Partial<Nip07>).signEvent === "function";

const nip07 = (): Nip07 | undefined => {
  const value = (window as { nostr?: unknown }).nostr;
  return isNip07(value) ? value : undefined;
};

export const hasNip07 = (): boolean => nip07() !== undefined;

/**
 * `window.nostr` が使えるようになるまで待つ。`timeoutMs` 以内に現れなければ false。
 *
 * NIP-07 拡張は content script として非同期に `window.nostr` を注入するため、
 * ページ読み込み直後は未定義のことがある（拡張や PC の負荷によっては数秒かかる）。
 */
export const waitForNip07 = (timeoutMs: number, signal?: AbortSignal): Promise<boolean> =>
  new Promise((resolve) => {
    if (hasNip07()) return resolve(true);
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (hasNip07()) finish(true);
      else if (Date.now() - startedAt >= timeoutMs) finish(false);
    }, 100);
    const finish = (found: boolean) => {
      clearInterval(timer);
      signal?.removeEventListener("abort", onAbort);
      resolve(found);
    };
    const onAbort = () => finish(hasNip07());
    signal?.addEventListener("abort", onAbort, { once: true });
  });

export const createNip07Signer = (): NostrSigner => {
  const get = (): Nip07 => {
    const ext = nip07();
    if (!ext) {
      throw new AppError(
        "nip07_unavailable",
        "NIP-07 対応のブラウザ拡張（nos2x, Alby など）が見つかりません。",
      );
    }
    return ext;
  };
  return {
    getPublicKey: async () => {
      try {
        return await get().getPublicKey();
      } catch (cause) {
        if (cause instanceof AppError) throw cause;
        throw new AppError("nip07_rejected", "NIP-07 拡張が公開鍵の提供を拒否しました。", {
          cause,
        });
      }
    },
    signEvent: async (event) => {
      try {
        return await get().signEvent(event);
      } catch (cause) {
        if (cause instanceof AppError) throw cause;
        throw new AppError("nip07_rejected", "NIP-07 拡張で署名が拒否されました。", { cause });
      }
    },
  };
};
