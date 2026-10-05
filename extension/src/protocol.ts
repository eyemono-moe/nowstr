import type { StatusPhase } from "./status/music-status-controller";

/**
 * service worker とポップアップ（"popup" ポート）の間でやり取りするメッセージ。
 *
 * - service worker → ポップアップ: `{ type: "playback", state }` / `{ type: "publisher", info }`
 * - ポップアップ → service worker: `{ type: "configure", config }`
 */

/** 投稿の設定。ポップアップで変更し、chrome.storage.local に保存する */
export type PublisherConfig = {
  enabled: boolean;
  fallbackRelays: string[];
  clearOnClose: boolean;
};

/** 投稿の状態。ポップアップで表示する */
export type PublisherInfo = {
  config: PublisherConfig;
  pubkey: string | null;
  relays: string[];
  relaySource: "nip65" | "fallback" | null;
  phase: StatusPhase;
  /** 掲示中の status の本文 */
  content: string | null;
  error: string | null;
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/** ポップアップから届いた設定を検証して読む */
export const parsePublisherConfig = (value: unknown): PublisherConfig | null => {
  if (typeof value !== "object" || value === null) return null;
  const { enabled, fallbackRelays, clearOnClose } = value as Record<string, unknown>;
  if (typeof enabled !== "boolean" || typeof clearOnClose !== "boolean") return null;
  if (!isStringArray(fallbackRelays)) return null;
  return { enabled, fallbackRelays, clearOnClose };
};
