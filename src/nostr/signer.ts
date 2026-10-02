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

const nip07 = (): Nip07 | undefined => (window as { nostr?: Nip07 }).nostr;

/**
 * NIP-07 拡張は content script として注入されるため、ページ読み込み直後は未定義のことがある。
 * 少しだけ待ってから判定する。
 */
export const waitForNip07 = async (timeoutMs = 1500): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  while (!nip07()) {
    if (Date.now() > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return true;
};

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
