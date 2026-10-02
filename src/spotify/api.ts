import { AppError } from "../lib/errors";
import { getSpotifyAccessToken } from "./auth";

/** Spotify Web API の薄いクライアント。Nowstr が使うのは再生の transfer だけ。 */

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
