import type { PlaybackState } from "../core/playback";
import { AppError } from "../lib/errors";
import { toPlaybackState } from "./mapping";

/**
 * Spotify Web Playback SDK のアダプタ。
 * Player インスタンスは main document に1つだけ作り、状態は PlaybackState に変換して通知する。
 */

const SDK_URL = "https://sdk.scdn.co/spotify-player.js";

let sdkLoading: Promise<void> | null = null;

const loadSdk = (): Promise<void> => {
  sdkLoading ??= new Promise<void>((resolve, reject) => {
    if (window.Spotify) return resolve();
    // SDK はロード完了時にこのグローバル関数を呼ぶ
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onerror = () => {
      sdkLoading = null;
      script.remove();
      reject(
        new AppError(
          "spotify_sdk_init_failed",
          "Spotify Web Playback SDK を読み込めませんでした。ネットワーク接続を確認してください。",
        ),
      );
    };
    document.head.append(script);
  });
  return sdkLoading;
};

export type SpotifyPlayerEvents = {
  getToken: () => Promise<string>;
  onReady: (deviceId: string) => void;
  onNotReady: () => void;
  /** null はこの device が非アクティブになった（他デバイスへ移った等）ことを表す */
  onState: (state: PlaybackState | null) => void;
  onError: (error: AppError) => void;
};

/**
 * Nowstr 側からは再生操作をしない（操作は Spotify 公式アプリから行う）ため、
 * 接続と autoplay 制限の解除だけを公開する。
 */
export type SpotifyPlayer = {
  connect: () => Promise<void>;
  disconnect: () => void;
  /** ブラウザの autoplay 制限対策。ユーザー操作のハンドラ内で同期的に呼ぶ */
  activateElement: () => void;
};

export const createSpotifyPlayer = async (
  name: string,
  events: SpotifyPlayerEvents,
): Promise<SpotifyPlayer> => {
  await loadSdk();

  const player = new window.Spotify.Player({
    name,
    // 音量は Spotify 公式アプリ（Spotify Connect）から調整する
    volume: 0.5,
    // OS のメディアキーやロック画面の操作に対応させる
    enableMediaSession: true,
    getOAuthToken: (callback) => {
      events.getToken().then(callback, (error: unknown) => {
        events.onError(
          error instanceof AppError
            ? error
            : new AppError("spotify_auth_error", "Spotify の認証情報を取得できませんでした。"),
        );
      });
    },
  });

  player.addListener("ready", ({ device_id }) => events.onReady(device_id));
  player.addListener("not_ready", () => events.onNotReady());
  player.addListener("player_state_changed", (state) =>
    events.onState(state ? toPlaybackState(state, Date.now()) : null),
  );
  player.addListener("initialization_error", ({ message }) =>
    events.onError(
      new AppError(
        "spotify_sdk_init_failed",
        `Spotify プレイヤーを初期化できませんでした。Chromium 系のデスクトップブラウザをご利用ください。(${message})`,
      ),
    ),
  );
  player.addListener("authentication_error", ({ message }) =>
    events.onError(
      new AppError(
        "spotify_auth_error",
        `Spotify の認証に失敗しました。再ログインしてください。(${message})`,
      ),
    ),
  );
  player.addListener("account_error", () =>
    events.onError(
      new AppError(
        "spotify_premium_required",
        "ブラウザでの再生には Spotify Premium アカウントが必要です。",
      ),
    ),
  );
  player.addListener("playback_error", ({ message }) =>
    events.onError(
      new AppError("spotify_playback_error", `曲を再生できませんでした。(${message})`),
    ),
  );
  player.addListener("autoplay_failed", () =>
    events.onError(
      new AppError(
        "spotify_playback_error",
        "ブラウザの自動再生制限により再生できませんでした。Nowstr のページで「このブラウザで再生」を押してください。",
      ),
    ),
  );

  return {
    connect: async () => {
      if (!(await player.connect())) {
        throw new AppError(
          "spotify_sdk_init_failed",
          "Spotify プレイヤーに接続できませんでした。ページを再読み込みしてください。",
        );
      }
    },
    disconnect: () => player.disconnect(),
    activateElement: () => void player.activateElement(),
  };
};
