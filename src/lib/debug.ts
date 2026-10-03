import type { PlaybackState } from "../core/playback";

/**
 * 動作確認用のログ。`localStorage.setItem("nowstr:debug", "0")` で止められる。
 * YouTube Music 連携の調査中は既定で出す。
 */
const enabled = (): boolean => {
  try {
    return localStorage.getItem("nowstr:debug") !== "0";
  } catch {
    return true;
  }
};

export const debugLog = (scope: string, ...args: unknown[]): void => {
  if (enabled()) console.info(`[Nowstr:${scope}]`, ...args);
};

export const describePlayback = (state: PlaybackState | null): string => {
  if (!state) return "null";
  const track = state.track
    ? `${state.track.title} / ${state.track.artists.join(", ")}`
    : "(track なし)";
  const sec = (ms: number) => Math.round(ms / 1000);
  return `${track} ${state.paused ? "⏸" : "▶"} ${sec(state.positionMs)}/${sec(state.durationMs)}s`;
};
