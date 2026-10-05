import type { PlaybackState } from "./playback";

/** Nostr に掲示する music status の内容 */
export type MusicStatus = {
  /** 曲の同一性の判定に使う（曲の https の URL） */
  trackUri: string;
  /**
   * r タグに入れるリンク。多くのクライアントがリンクとして表示できるよう、可能なら https の URL にする。
   * 限定公開・非公開の動画など、リンクを出さない曲では null
   */
  url: string | null;
  content: string;
  /** 曲が終わると予想される時刻 (Unix 秒) */
  expiresAt: number;
};

export type StatusAction =
  | { type: "publish"; status: MusicStatus }
  | { type: "clear" }
  | { type: "none" };

/**
 * 終了予想時刻の差がこの秒数以内なら同じ status とみなす。
 * SDK の position には多少の揺らぎがあるため、それによる再投稿を防ぐ。
 */
export const EXPIRATION_TOLERANCE_SEC = 10;

/** 曲が終了すると予想される Unix 秒（観測時刻 + 残り時間） */
export const computeExpiration = (state: PlaybackState): number => {
  const remainingMs = Math.max(0, state.durationMs - state.positionMs);
  return Math.ceil((state.updatedAt + remainingMs) / 1000);
};

/** 再生状態から「いま掲示されているべき status」を求める。掲示すべきでなければ null */
export const desiredMusicStatus = (state: PlaybackState | null): MusicStatus | null => {
  if (!state?.track || state.paused) return null;
  const { track } = state;
  return {
    trackUri: track.uri,
    url: track.unlisted ? null : track.uri,
    content: `${track.title} - ${track.artists.join(", ")}`,
    expiresAt: computeExpiration(state),
  };
};

/**
 * 掲示済みの status と、あるべき status を比較して必要な操作を決める。
 *
 * - 未掲示 → 再生中: publish（再生開始 / resume）
 * - 曲が変わった: publish
 * - 同じ曲でリンクの有無が変わった（限定公開と後から分かった）: publish
 * - 同じ曲で終了予想が大きくずれた（seek / リピート）: publish
 * - 掲示済み → 停止・切断: clear
 * - 再生位置が進んだだけ: 何もしない
 */
export const decideStatusAction = (
  published: MusicStatus | null,
  desired: MusicStatus | null,
): StatusAction => {
  if (desired === null) return published === null ? { type: "none" } : { type: "clear" };
  if (
    published === null ||
    published.trackUri !== desired.trackUri ||
    published.content !== desired.content ||
    published.url !== desired.url ||
    Math.abs(published.expiresAt - desired.expiresAt) > EXPIRATION_TOLERANCE_SEC
  ) {
    return { type: "publish", status: desired };
  }
  return { type: "none" };
};
