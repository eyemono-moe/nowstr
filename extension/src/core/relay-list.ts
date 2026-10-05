/** NIP-65 relay list metadata */
export const RELAY_LIST_KIND = 10002;

export const DEFAULT_FALLBACK_RELAYS = ["wss://relay.damus.io", "wss://nos.lol", "wss://yabu.me"];

/** kind:10002 を探しに行く relay（fallback relay に加えて使う、relay list が集まりやすい relay） */
export const RELAY_LIST_INDEXERS = ["wss://purplepag.es", "wss://directory.yabu.me"];

export const normalizeRelayUrl = (raw: string): string | null => {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "wss:" && url.protocol !== "ws:") return null;
    return url.toString();
  } catch {
    return null;
  }
};

/** kind:10002 の tags から write relay（marker なし or `write`）を取り出す */
export const parseWriteRelays = (tags: string[][]): string[] => {
  const relays = new Set<string>();
  for (const [name, url, marker] of tags) {
    if (name !== "r" || !url) continue;
    if (marker !== undefined && marker !== "write") continue;
    const normalized = normalizeRelayUrl(url);
    if (normalized) relays.add(normalized);
  }
  return [...relays];
};
