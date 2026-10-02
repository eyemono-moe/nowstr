export const SPOTIFY_CLIENT_ID: string = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? "";

/**
 * Spotify Developer Dashboard に登録する Redirect URI と一致させること。
 * ページは1枚だけなので、サイトのトップ（`/`）に戻ってきてもらう。
 */
export const spotifyRedirectUri = (): string =>
  import.meta.env.VITE_SPOTIFY_REDIRECT_URI || `${location.origin}/`;

/**
 * 必要最小限の scope。
 * - streaming / user-read-email / user-read-private: Web Playback SDK の要件
 * - user-modify-playback-state: 再生をこのブラウザ（Nowstr デバイス）へ移す
 */
export const SPOTIFY_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-modify-playback-state",
] as const;
