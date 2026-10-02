/**
 * Spotify SDK に依存しない、アプリ共通の再生状態表現。
 * UI や Nostr 連携はこの型だけを参照する。
 */
export type Track = {
  /** `spotify:track:...` 形式の URI */
  uri: string;
  title: string;
  artists: string[];
  album: string;
  artworkUrl: string | null;
  durationMs: number;
};

export type PlaybackState = {
  track: Track | null;
  paused: boolean;
  /** `updatedAt` 時点での再生位置 */
  positionMs: number;
  durationMs: number;
  /** この状態を観測した時刻 (Unix ミリ秒) */
  updatedAt: number;
};

export const isSameTrack = (a: Track | null, b: Track | null): boolean =>
  a === null || b === null ? a === b : a.uri === b.uri;

/** 観測時刻からの経過時間を加味した現在の再生位置 */
export const currentPositionMs = (state: PlaybackState, now: number): number => {
  const elapsed = state.paused ? 0 : Math.max(0, now - state.updatedAt);
  return Math.min(state.positionMs + elapsed, state.durationMs);
};
