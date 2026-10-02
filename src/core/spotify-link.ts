const LINKABLE_TYPES = new Set(["track", "episode", "album", "artist", "playlist", "show"]);

/**
 * `spotify:<type>:<id>` 形式の URI を Spotify の Web URL に変換する。
 * Spotify のメタデータを表示するときは Spotify へのリンクを添える必要がある（Developer Policy）。
 */
export const spotifyWebUrl = (uri: string): string | null => {
  const [scheme, type, id, ...rest] = uri.split(":");
  if (scheme !== "spotify" || !type || !id || rest.length > 0 || !LINKABLE_TYPES.has(type)) {
    return null;
  }
  return `https://open.spotify.com/${type}/${id}`;
};
