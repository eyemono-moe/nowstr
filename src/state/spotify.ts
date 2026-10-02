import { batch, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import type { PlaybackState } from "../core/playback";
import { AppError } from "../lib/errors";
import { fetchMyPlaylists, playContext, transferPlayback, type Playlist } from "../spotify/api";
import {
  clearSpotifyToken,
  getSpotifyAccessToken,
  handleSpotifyCallback,
  hasStoredToken,
  isSpotifyConfigured,
  startSpotifyLogin,
} from "../spotify/auth";
import { createSpotifyPlayer, type SpotifyPlayer } from "../spotify/player";
import { settings, updateSettings } from "./settings";
import { notifyError } from "./toast";

/**
 * Spotify 側の状態。Web Playback SDK の state を source of truth とする。
 * Spotify アカウント全体の再生状態はポーリングしない。
 */

export type PlayerStatus = "idle" | "connecting" | "ready" | "offline" | "error";

type SpotifyStore = {
  configured: boolean;
  loggedIn: boolean;
  player: PlayerStatus;
  deviceId: string | null;
  error: AppError | null;
  playlists: Playlist[] | null;
  playlistsLoading: boolean;
};

const [store, setStore] = createStore<SpotifyStore>({
  configured: isSpotifyConfigured(),
  loggedIn: hasStoredToken(),
  player: "idle",
  deviceId: null,
  error: null,
  playlists: null,
  playlistsLoading: false,
});

/** この browser device の再生状態。他デバイスで再生中、または未接続なら null */
const [playback, setPlayback] = createSignal<PlaybackState | null>(null);

export { playback, store as spotify };

let player: SpotifyPlayer | null = null;

const fail = (error: unknown) => {
  const appError =
    error instanceof AppError
      ? error
      : new AppError("spotify_api_error", "Spotify との通信に失敗しました。", { cause: error });
  notifyError(appError, "Spotify");
  // 認証が失われた場合はログアウト状態に戻す
  if (appError.code === "spotify_token_refresh_failed" || appError.code === "spotify_auth_error") {
    logoutSpotify();
  }
};

const isFatalPlayerError = (error: AppError) =>
  error.code === "spotify_premium_required" || error.code === "spotify_sdk_init_failed";

const connectPlayer = async () => {
  if (player) return;
  setStore({ player: "connecting", error: null });
  try {
    player = await createSpotifyPlayer("Nowstr", settings.volume, {
      getToken: () => getSpotifyAccessToken(),
      onReady: (deviceId) => setStore({ player: "ready", deviceId }),
      onNotReady: () => {
        batch(() => {
          setStore({ player: "offline" });
          setPlayback(null);
        });
      },
      onState: setPlayback,
      onError: (error) => {
        if (isFatalPlayerError(error)) {
          batch(() => {
            setStore({ player: "error", error });
            setPlayback(null);
          });
          player?.disconnect();
          player = null;
        }
        fail(error);
      },
    });
    await player.connect();
  } catch (error) {
    player = null;
    const appError =
      error instanceof AppError
        ? error
        : new AppError("spotify_sdk_init_failed", "Spotify プレイヤーを初期化できませんでした。", {
            cause: error,
          });
    setStore({ player: "error", error: appError });
    fail(appError);
  }
};

/** 起動時処理。OAuth コールバックの処理と、ログイン済みならプレイヤーの接続を行う */
export const initSpotify = async (): Promise<void> => {
  try {
    if (await handleSpotifyCallback()) setStore({ loggedIn: true });
  } catch (error) {
    fail(error);
  }
  if (store.loggedIn) {
    await connectPlayer();
    void loadPlaylists();
  }
};

export const loginSpotify = (): void => {
  startSpotifyLogin().catch(fail);
};

export const logoutSpotify = (): void => {
  player?.disconnect();
  player = null;
  clearSpotifyToken();
  batch(() => {
    setStore({ loggedIn: false, player: "idle", deviceId: null, playlists: null });
    setPlayback(null);
  });
};

export const retryPlayer = (): void => {
  player?.disconnect();
  player = null;
  void connectPlayer();
};

export const loadPlaylists = async (): Promise<void> => {
  setStore({ playlistsLoading: true });
  try {
    setStore({ playlists: await fetchMyPlaylists() });
  } catch (error) {
    fail(error);
  } finally {
    setStore({ playlistsLoading: false });
  }
};

// 以下の操作はクリックハンドラから同期的に呼ばれる前提で、
// 先に activateElement() を呼んでブラウザの autoplay 制限を回避する。

export const transferHere = (): void => {
  if (!player || !store.deviceId) return;
  player.activateElement();
  transferPlayback(store.deviceId, true).catch(fail);
};

export const playPlaylist = (contextUri: string): void => {
  if (!player || !store.deviceId) return;
  player.activateElement();
  playContext(store.deviceId, contextUri).catch(fail);
};

export const togglePlay = (): void => {
  if (!player) return;
  player.activateElement();
  player.togglePlay().catch(fail);
};

export const previousTrack = (): void => void player?.previousTrack().catch(fail);
export const nextTrack = (): void => void player?.nextTrack().catch(fail);

export const seek = (positionMs: number): void => {
  if (!player) return;
  // 結果を待たずに UI を追従させる（SDK の state 通知で確定値に置き換わる）
  setPlayback((prev) => (prev ? { ...prev, positionMs, updatedAt: Date.now() } : prev));
  player.seek(positionMs).catch(fail);
};

export const setVolume = (volume: number): void => {
  updateSettings({ volume });
  void player?.setVolume(volume).catch(fail);
};
