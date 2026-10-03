import { createMemo } from "solid-js";
import type { PlaybackState } from "../core/playback";
import { isSpotifyConfigured } from "../spotify/auth";
import { settings, updateSettings } from "./settings";
import { playback as spotifyPlayback } from "./spotify";
import { youtubePlayback } from "./youtube";

/**
 * 再生中の曲をどこから取るか。
 * Spotify は Client ID がビルド時に設定されているときだけ選べる（他の人がホスティングしたときを想定）。
 */
export type PlaybackSource = "spotify" | "youtube-music";

export const SOURCE_LABELS: Record<PlaybackSource, string> = {
  spotify: "Spotify",
  "youtube-music": "YouTube Music",
};

/**
 * 並び順がそのまま UI の表示順と初期選択になる。
 * Spotify は Development Mode の制約（Premium 必須・5人まで）が厳しいので、YouTube Music を主にする。
 */
export const availableSources: PlaybackSource[] = isSpotifyConfigured()
  ? ["youtube-music", "spotify"]
  : ["youtube-music"];

export const activeSource = createMemo<PlaybackSource>(() =>
  settings.source && availableSources.includes(settings.source)
    ? settings.source
    : availableSources[0]!,
);

export const selectSource = (source: PlaybackSource): void => updateSettings({ source });

/** 選んでいる再生元の再生状態。Nostr の status はこれだけを見る */
export const activePlayback = (): PlaybackState | null =>
  activeSource() === "spotify" ? spotifyPlayback() : youtubePlayback();
