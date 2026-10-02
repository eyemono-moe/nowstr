import { AppError } from "../lib/errors";
import { getSpotifyAccessToken } from "./auth";

/** Spotify Web API の薄いクライアント。Nowstr が使うエンドポイントだけを持つ。 */

const API_BASE = "https://api.spotify.com/v1";

export class SpotifyApiError extends Error {
  override readonly name = "SpotifyApiError";
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const spotifyFetch = async <T>(
  path: string,
  init: RequestInit = {},
  retried = false,
): Promise<T> => {
  const token = await getSpotifyAccessToken(retried);
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (res.status === 401 && !retried) return spotifyFetch(path, init, true);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new SpotifyApiError(res.status, body?.error?.message ?? res.statusText);
  }
  if (res.status === 204 || res.headers.get("content-length") === "0") return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
};

export type Playlist = {
  id: string;
  uri: string;
  name: string;
  imageUrl: string | null;
  ownerName: string | null;
};

type PlaylistObject = {
  id: string;
  uri: string;
  name: string;
  images: { url: string; width: number | null }[] | null;
  owner: { display_name: string | null } | null;
};

type Paging<T> = { items: (T | null)[]; next: string | null };

/** ユーザーが保存・作成したプレイリストを全件取得する */
export const fetchMyPlaylists = async (): Promise<Playlist[]> => {
  const playlists: Playlist[] = [];
  let path: string | null = "/me/playlists?limit=50";
  while (path) {
    const page: Paging<PlaylistObject> = await spotifyFetch(path);
    for (const item of page.items) {
      if (!item) continue;
      // 小さい画像を優先する（一覧表示用）
      const images = [...(item.images ?? [])].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
      playlists.push({
        id: item.id,
        uri: item.uri,
        name: item.name,
        imageUrl: images.find((image) => (image.width ?? 300) >= 60)?.url ?? images[0]?.url ?? null,
        ownerName: item.owner?.display_name ?? null,
      });
    }
    path = page.next ? page.next.replace(API_BASE, "") : null;
  }
  return playlists;
};

/** 再生をこのブラウザの device に移す */
export const transferPlayback = async (deviceId: string, play: boolean): Promise<void> => {
  try {
    await spotifyFetch("/me/player", {
      method: "PUT",
      body: JSON.stringify({ device_ids: [deviceId], play }),
    });
  } catch (cause) {
    throw new AppError(
      "spotify_transfer_failed",
      "このブラウザへの再生の切り替えに失敗しました。少し待ってから再度お試しください。",
      { cause },
    );
  }
};

/** プレイリスト等の context をこの device で再生する */
export const playContext = async (deviceId: string, contextUri: string): Promise<void> => {
  try {
    await spotifyFetch(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
      method: "PUT",
      body: JSON.stringify({ context_uri: contextUri }),
    });
  } catch (cause) {
    throw new AppError(
      "spotify_playback_error",
      cause instanceof SpotifyApiError && cause.status === 404
        ? "再生デバイスが見つかりません。プレイヤーの再接続をお試しください。"
        : "プレイリストの再生を開始できませんでした。",
      { cause },
    );
  }
};
