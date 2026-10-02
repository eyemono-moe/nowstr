export const SPOTIFY_CLIENT_ID: string = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? "";

/** Spotify Developer Dashboard に登録する Redirect URI と一致させること */
export const spotifyRedirectUri = (): string =>
  import.meta.env.VITE_SPOTIFY_REDIRECT_URI || `${location.origin}/callback`;

/**
 * 必要最小限の scope。
 * - streaming / user-read-email / user-read-private: Web Playback SDK の要件
 * - user-read-playback-state / user-modify-playback-state: 再生デバイスの transfer と再生開始
 * - playlist-read-private / playlist-read-collaborative: プレイリスト一覧
 */
export const SPOTIFY_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "playlist-read-private",
  "playlist-read-collaborative",
] as const;
