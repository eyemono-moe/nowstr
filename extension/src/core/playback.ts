/** 曲を再生している音楽サービス */
export type MusicService = "youtube-music" | "spotify" | "soundcloud" | "amazon-music";

export const MUSIC_SERVICE_LABELS: Record<MusicService, string> = {
  "youtube-music": "YouTube Music",
  spotify: "Spotify",
  soundcloud: "SoundCloud",
  "amazon-music": "Amazon Music",
};

/**
 * 音楽サービスに依存しない再生状態の表現。content script（content/types.d.ts の BridgePlaybackState）と同じ形。
 * Nostr 連携とポップアップはこの型だけを参照する。
 */
export type Track = {
  source: MusicService;
  /** 曲の https の URL。曲の同一性の判定にも使う */
  uri: string;
  title: string;
  artists: string[];
  album: string;
  artworkUrl: string | null;
  durationMs: number;
  /** YouTube の限定公開・非公開の動画。URL を知った人なら誰でも見られてしまうため、リンクを出さない */
  unlisted?: boolean;
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
