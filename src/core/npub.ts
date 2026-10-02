import { bech32, hex } from "@scure/base";

/** NIP-19: hex 公開鍵を npub に変換する */
export const toNpub = (pubkeyHex: string): string =>
  bech32.encode("npub", bech32.toWords(hex.decode(pubkeyHex)));

export const shortenNpub = (npub: string): string => `${npub.slice(0, 12)}…${npub.slice(-6)}`;
