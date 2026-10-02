import { batch, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import type { PlaybackState } from "../core/playback";
import { AppError } from "../lib/errors";
import { transferPlayback } from "../spotify/api";
import {
  clearSpotifyToken,
  getSpotifyAccessToken,
  handleSpotifyCallback,
  hasStoredToken,
  isSpotifyConfigured,
  startSpotifyLogin,
} from "../spotify/auth";
import { createSpotifyPlayer, type SpotifyPlayer } from "../spotify/player";
import { notifyError } from "./toast";

/**
 * Spotify 側の状態。Web Playback SDK の state を source of truth とする。
 * Nowstr はこのブラウザを Spotify Connect デバイスにするだけで、再生操作は Spotify 公式アプリから行う。
 * Spotify アカウント全体の再生状態はポーリングしない。
 */

export type PlayerStatus = "idle" | "connecting" | "ready" | "offline" | "error";

type SpotifyStore = {
  configured: boolean;
  loggedIn: boolean;
  player: PlayerStatus;
  deviceId: string | null;
  error: AppError | null;
};

const [store, setStore] = createStore<SpotifyStore>({
  configured: isSpotifyConfigured(),
  loggedIn: hasStoredToken(),
  player: "idle",
  deviceId: null,
  error: null,
});

/** この browser device の再生状態。他デバイスで再生中、または未接続なら null */
const [playback, setPlayback] = createSignal<PlaybackState | null>(null);

export { playback, store as spotify };

/** Spotify アプリのデバイス一覧に表示される名前 */
export const DEVICE_NAME = "Nowstr";

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
    player = await createSpotifyPlayer(DEVICE_NAME, {
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
  if (store.loggedIn) await connectPlayer();
};

export const loginSpotify = (): void => {
  startSpotifyLogin().catch(fail);
};

export const logoutSpotify = (): void => {
  player?.disconnect();
  player = null;
  clearSpotifyToken();
  batch(() => {
    setStore({ loggedIn: false, player: "idle", deviceId: null });
    setPlayback(null);
  });
};

export const retryPlayer = (): void => {
  player?.disconnect();
  player = null;
  void connectPlayer();
};

/**
 * 再生をこのブラウザに移す。クリックハンドラから同期的に呼ぶこと。
 * 先に activateElement() を呼んでブラウザの autoplay 制限を解除しておくと、
 * 以降は Spotify 公式アプリからこのデバイスを選んでも再生できる。
 */
export const transferHere = (): void => {
  if (!player || !store.deviceId) return;
  player.activateElement();
  transferPlayback(store.deviceId, true).catch(fail);
};
