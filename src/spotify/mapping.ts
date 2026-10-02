import type { PlaybackState, Track } from "../core/playback";

/** Web Playback SDK の型をアプリ共通表現に変換する。SDK 固有の型はこのファイルの外に出さない。 */

const pickArtwork = (images: Spotify.Image[]): string | null => {
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  // 640px 以下で最大のものを使う（Spotify は通常 640 / 300 / 64 の3サイズを返す）
  return (sorted.find((image) => (image.width ?? 0) <= 640) ?? sorted[0])?.url ?? null;
};

export const toTrack = (track: Spotify.Track): Track | null => {
  // 広告は music status として扱わない
  if (track.type === "ad") return null;
  return {
    uri: track.uri,
    title: track.name,
    artists: track.artists.map((artist) => artist.name),
    album: track.album.name,
    artworkUrl: pickArtwork(track.album.images),
    durationMs: track.duration_ms,
  };
};

export const toPlaybackState = (state: Spotify.PlaybackState, now: number): PlaybackState => {
  const current = state.track_window.current_track;
  const track = current ? toTrack(current) : null;
  return {
    track,
    paused: state.paused,
    positionMs: state.position,
    durationMs: track?.durationMs ?? state.duration,
    // SDK の timestamp は position を計測した時刻。端末時計とのずれを避けるため受信時刻を使う
    updatedAt: now,
  };
};
