import type { MusicStatus } from "./music-status";

/** NIP-38 User Status */
export const MUSIC_STATUS_KIND = 30315;
const MUSIC_D_TAG = ["d", "music"];

export type EventTemplate = {
  kind: number;
  created_at: number;
  content: string;
  tags: string[][];
};

export const buildMusicStatusEvent = (status: MusicStatus, createdAt: number): EventTemplate => ({
  kind: MUSIC_STATUS_KIND,
  created_at: createdAt,
  content: status.content,
  tags: [MUSIC_D_TAG, ["r", status.url], ["expiration", String(status.expiresAt)]],
});

/** NIP-38: content が空文字の status は「status なし」として扱われる */
export const buildClearMusicStatusEvent = (createdAt: number): EventTemplate => ({
  kind: MUSIC_STATUS_KIND,
  created_at: createdAt,
  content: "",
  tags: [MUSIC_D_TAG],
});
