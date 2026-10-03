import { describe, expect, it } from "vite-plus/test";
import {
  computeExpiration,
  decideStatusAction,
  desiredMusicStatus,
  type MusicStatus,
} from "./music-status";
import type { PlaybackState, Track } from "./playback";

const trackA: Track = {
  uri: "spotify:track:a",
  title: "Intergalactic",
  artists: ["Beastie Boys"],
  album: "Hello Nasty",
  artworkUrl: null,
  durationMs: 230_000,
};
const trackB: Track = { ...trackA, uri: "spotify:track:b", title: "Sabotage" };

const playing = (overrides: Partial<PlaybackState> = {}): PlaybackState => ({
  track: trackA,
  paused: false,
  positionMs: 30_000,
  durationMs: 230_000,
  updatedAt: 1_700_000_000_000,
  ...overrides,
});

describe("computeExpiration", () => {
  it("now + (duration - position) を Unix 秒で返す", () => {
    // 1_700_000_000_000ms + 200_000ms = 1_700_000_200 秒
    expect(computeExpiration(playing())).toBe(1_700_000_200);
  });

  it("端数は切り上げる（曲の途中で消えないように）", () => {
    expect(computeExpiration(playing({ positionMs: 30_500 }))).toBe(1_700_000_200);
    expect(computeExpiration(playing({ positionMs: 29_500 }))).toBe(1_700_000_201);
  });

  it("位置が duration を超えていても過去にはならない", () => {
    expect(computeExpiration(playing({ positionMs: 999_999 }))).toBe(1_700_000_000);
  });

  it("再生位置が進んでも予想終了時刻は変わらない", () => {
    const later = playing({ positionMs: 60_000, updatedAt: 1_700_000_030_000 });
    expect(computeExpiration(later)).toBe(computeExpiration(playing()));
  });
});

describe("desiredMusicStatus", () => {
  it("再生中なら status を返す", () => {
    expect(desiredMusicStatus(playing())).toEqual({
      trackUri: "spotify:track:a",
      url: "https://open.spotify.com/track/a",
      content: "Intergalactic - Beastie Boys",
      expiresAt: 1_700_000_200,
    });
  });

  it("リンクは Web の URL にする（YouTube Music はそのまま、Web の URL がない Spotify の URI はそのまま）", () => {
    const youtube = "https://music.youtube.com/watch?v=abc";
    expect(desiredMusicStatus(playing({ track: { ...trackA, uri: youtube } }))?.url).toBe(youtube);
    const local = "spotify:local:Artist:Album:Title:180";
    expect(desiredMusicStatus(playing({ track: { ...trackA, uri: local } }))?.url).toBe(local);
  });

  it("複数アーティストはカンマで連結する", () => {
    const state = playing({ track: { ...trackA, artists: ["A", "B"] } });
    expect(desiredMusicStatus(state)?.content).toBe("Intergalactic - A, B");
  });

  it("一時停止中・曲なし・切断時は null", () => {
    expect(desiredMusicStatus(playing({ paused: true }))).toBeNull();
    expect(desiredMusicStatus(playing({ track: null }))).toBeNull();
    expect(desiredMusicStatus(null)).toBeNull();
  });
});

describe("decideStatusAction", () => {
  const published: MusicStatus = {
    trackUri: "spotify:track:a",
    url: "https://open.spotify.com/track/a",
    content: "Intergalactic - Beastie Boys",
    expiresAt: 1_700_000_200,
  };

  it("再生開始: 未投稿 → 再生中なら publish", () => {
    const desired = desiredMusicStatus(playing());
    expect(decideStatusAction(null, desired)).toEqual({ type: "publish", status: desired });
  });

  it("曲が変わったら publish", () => {
    const desired = desiredMusicStatus(playing({ track: trackB }));
    expect(decideStatusAction(published, desired)).toEqual({ type: "publish", status: desired });
  });

  it("同じ曲で位置が進んだだけなら何もしない", () => {
    const desired = desiredMusicStatus(
      playing({ positionMs: 90_000, updatedAt: 1_700_000_060_000 }),
    );
    expect(decideStatusAction(published, desired)).toEqual({ type: "none" });
  });

  it("多少の誤差（許容範囲内）では再投稿しない", () => {
    const desired = { ...published, expiresAt: published.expiresAt + 3 };
    expect(decideStatusAction(published, desired)).toEqual({ type: "none" });
  });

  it("seek やリピートで終了予想が大きくずれたら publish し直す", () => {
    const desired = desiredMusicStatus(playing({ positionMs: 0 }));
    expect(decideStatusAction(published, desired)).toEqual({ type: "publish", status: desired });
  });

  it("pause: 投稿済みなら clear", () => {
    expect(decideStatusAction(published, desiredMusicStatus(playing({ paused: true })))).toEqual({
      type: "clear",
    });
  });

  it("disconnect: 投稿済みなら clear", () => {
    expect(decideStatusAction(published, desiredMusicStatus(null))).toEqual({ type: "clear" });
  });

  it("未投稿のまま停止中なら何もしない", () => {
    expect(decideStatusAction(null, null)).toEqual({ type: "none" });
  });

  it("resume: clear 後に再生再開したら expiration を再計算して publish", () => {
    const resumed = playing({ positionMs: 100_000, updatedAt: 1_700_000_500_000 });
    const desired = desiredMusicStatus(resumed);
    expect(desired?.expiresAt).toBe(1_700_000_630);
    expect(decideStatusAction(null, desired)).toEqual({ type: "publish", status: desired });
  });
});
