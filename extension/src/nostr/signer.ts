import type { EventTemplate } from "../core/nip38";

export type SignedEvent = EventTemplate & { id: string; pubkey: string; sig: string };

/**
 * Nostr の署名処理の抽象。拡張では音楽サービスのタブの NIP-07 に依頼する（tab-signer.ts）。
 * Nowstr は秘密鍵を保持しない。
 */
export interface NostrSigner {
  getPublicKey(): Promise<string>;
  signEvent(event: EventTemplate): Promise<SignedEvent>;
}
