/** NIP-65 relay list metadata */
export const RELAY_LIST_KIND = 10002;

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
