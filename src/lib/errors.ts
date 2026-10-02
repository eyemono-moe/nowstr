/**
 * ユーザーに提示するエラー。`code` で原因を区別し、`message` は UI にそのまま出せる文言にする。
 */
export type AppErrorCode =
  | "spotify_not_configured"
  | "spotify_oauth_failed"
  | "spotify_token_refresh_failed"
  | "spotify_premium_required"
  | "spotify_sdk_init_failed"
  | "spotify_auth_error"
  | "spotify_playback_error"
  | "spotify_transfer_failed"
  | "spotify_api_error"
  | "nip07_unavailable"
  | "nip07_rejected"
  | "relay_connection_failed"
  | "relay_publish_failed";

export class AppError extends Error {
  override readonly name = "AppError";
  readonly code: AppErrorCode;
  constructor(code: AppErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.code = code;
  }
}

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
