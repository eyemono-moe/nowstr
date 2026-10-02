import { AppError } from "../lib/errors";
import { loadJson, removeItem, saveJson } from "../lib/storage";
import { SPOTIFY_CLIENT_ID, SPOTIFY_SCOPES, spotifyRedirectUri } from "./config";

/**
 * Spotify Authorization Code Flow with PKCE。
 * SPA 単体で完結させるため client secret は使わない。
 */

const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const TOKEN_KEY = "nowstr:spotify:token";
const PKCE_KEY = "nowstr:spotify:pkce";
/** 有効期限のこの時間前になったら先回りして refresh する */
const REFRESH_MARGIN_MS = 60_000;

type StoredToken = {
  accessToken: string;
  refreshToken: string;
  /** Unix ミリ秒 */
  expiresAt: number;
  scope: string;
};

type TokenResponse = {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
};

const base64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const randomString = (byteLength: number): string =>
  base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));

const sha256 = async (input: string): Promise<Uint8Array> =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)));

export const isSpotifyConfigured = (): boolean => SPOTIFY_CLIENT_ID !== "";

export const hasStoredToken = (): boolean => loadJson<StoredToken>(TOKEN_KEY) !== null;

/** Spotify の認可画面へ遷移する */
export const startSpotifyLogin = async (): Promise<void> => {
  if (!isSpotifyConfigured()) {
    throw new AppError(
      "spotify_not_configured",
      "Spotify Client ID が設定されていません。README を参照して VITE_SPOTIFY_CLIENT_ID を設定してください。",
    );
  }
  const verifier = randomString(64);
  const state = randomString(16);
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state }));

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: spotifyRedirectUri(),
    code_challenge_method: "S256",
    code_challenge: base64Url(await sha256(verifier)),
    scope: SPOTIFY_SCOPES.join(" "),
    state,
  });
  location.assign(`${AUTHORIZE_URL}?${params}`);
};

const requestToken = async (body: Record<string, string>): Promise<TokenResponse> => {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID, ...body }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`token endpoint ${res.status}: ${detail}`);
  }
  return (await res.json()) as TokenResponse;
};

const storeToken = (res: TokenResponse, previousRefreshToken?: string): StoredToken => {
  const refreshToken = res.refresh_token ?? previousRefreshToken;
  if (!refreshToken) throw new Error("refresh_token is missing");
  const token: StoredToken = {
    accessToken: res.access_token,
    // refresh 時にはローテーションされないことがある。その場合は以前の値を使い続ける
    refreshToken,
    expiresAt: Date.now() + res.expires_in * 1000,
    scope: res.scope,
  };
  saveJson(TOKEN_KEY, token);
  return token;
};

/**
 * Redirect URI に戻ってきた場合に認可コードを token に交換する。
 * コールバックでなければ false を返す。
 */
export const handleSpotifyCallback = async (): Promise<boolean> => {
  const url = new URL(location.href);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (!code && !error) return false;

  const pkce = (() => {
    try {
      return JSON.parse(sessionStorage.getItem(PKCE_KEY) ?? "null") as {
        verifier: string;
        state: string;
      } | null;
    } catch {
      return null;
    }
  })();
  sessionStorage.removeItem(PKCE_KEY);
  // URL から code 等を消して通常画面に戻す
  history.replaceState(null, "", "/");

  if (error) {
    throw new AppError(
      "spotify_oauth_failed",
      error === "access_denied"
        ? "Spotify へのアクセスが許可されませんでした。"
        : `Spotify ログインに失敗しました (${error})。`,
    );
  }
  if (!pkce || pkce.state !== url.searchParams.get("state")) {
    throw new AppError(
      "spotify_oauth_failed",
      "Spotify ログインの検証に失敗しました。もう一度ログインしてください。",
    );
  }
  try {
    storeToken(
      await requestToken({
        grant_type: "authorization_code",
        code: code!,
        redirect_uri: spotifyRedirectUri(),
        code_verifier: pkce.verifier,
      }),
    );
  } catch (cause) {
    throw new AppError(
      "spotify_oauth_failed",
      "Spotify のアクセストークン取得に失敗しました。Client ID と Redirect URI の設定を確認してください。",
      { cause },
    );
  }
  return true;
};

let refreshing: Promise<StoredToken> | null = null;

const refresh = (token: StoredToken): Promise<StoredToken> => {
  refreshing ??= requestToken({ grant_type: "refresh_token", refresh_token: token.refreshToken })
    .then((res) => storeToken(res, token.refreshToken))
    .catch((cause: unknown) => {
      removeItem(TOKEN_KEY);
      throw new AppError(
        "spotify_token_refresh_failed",
        "Spotify のログイン期限が切れました。もう一度ログインしてください。",
        { cause },
      );
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
};

/**
 * 有効なアクセストークンを返す。期限切れが近ければ refresh する。
 * `force` は API が 401 を返した場合など、期限内でも refresh したいときに使う。
 */
export const getSpotifyAccessToken = async (force = false): Promise<string> => {
  const token = loadJson<StoredToken>(TOKEN_KEY);
  if (!token) {
    throw new AppError("spotify_token_refresh_failed", "Spotify にログインしていません。");
  }
  if (!force && token.expiresAt - REFRESH_MARGIN_MS > Date.now()) return token.accessToken;
  return (await refresh(token)).accessToken;
};

export const clearSpotifyToken = (): void => removeItem(TOKEN_KEY);
