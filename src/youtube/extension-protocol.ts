import type { PlaybackState, Track } from "../core/playback";

/**
 * Nowstr Bridge（ブラウザ拡張, `extension/`）と Nowstr のページの間でやり取りする window.postMessage の形式。
 * 拡張側の `extension/bridge.js` と揃えること。
 *
 * - 拡張 → ページ: `{ [TAG]: "extension", type: "hello", version }` / `{ [TAG]: "extension", type: "playback", state }`
 * - ページ → 拡張: `{ [TAG]: "page", type: "ping" }`
 */
export const EXTENSION_MESSAGE_TAG = "__nowstr";

export type ExtensionMessage =
  | { type: "hello"; version: string }
  | { type: "playback"; state: PlaybackState | null };

export const pingMessage = { [EXTENSION_MESSAGE_TAG]: "page", type: "ping" } as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isYouTubeMusicUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "music.youtube.com";
  } catch {
    return false;
  }
};

const isHttpsUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

const parseTrack = (value: unknown): Track | null | undefined => {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const { uri, title, artists, album, artworkUrl, durationMs } = value;
  if (
    !isYouTubeMusicUrl(uri) ||
    typeof title !== "string" ||
    !Array.isArray(artists) ||
    !artists.every((artist) => typeof artist === "string") ||
    typeof album !== "string" ||
    !(artworkUrl === null || isHttpsUrl(artworkUrl)) ||
    !isFiniteNumber(durationMs)
  ) {
    return undefined;
  }
  return { uri, title, artists, album, artworkUrl, durationMs };
};

const parseState = (value: unknown): PlaybackState | null | undefined => {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const track = parseTrack(value.track);
  const { paused, positionMs, durationMs, updatedAt } = value;
  if (
    track === undefined ||
    typeof paused !== "boolean" ||
    !isFiniteNumber(positionMs) ||
    !isFiniteNumber(durationMs) ||
    !isFiniteNumber(updatedAt)
  ) {
    return undefined;
  }
  return { track, paused, positionMs, durationMs, updatedAt };
};

/**
 * 拡張からのメッセージを検証して読む。他の拡張やページ内のスクリプトも postMessage できるため、
 * 形式が合わないもの（特に URL）は捨てる。
 */
export const parseExtensionMessage = (data: unknown): ExtensionMessage | null => {
  if (!isRecord(data) || data[EXTENSION_MESSAGE_TAG] !== "extension") return null;
  if (data.type === "hello") {
    return typeof data.version === "string" ? { type: "hello", version: data.version } : null;
  }
  if (data.type === "playback") {
    const state = parseState(data.state);
    return state === undefined ? null : { type: "playback", state };
  }
  return null;
};
