import { describe, expect, it } from "vite-plus/test";
import { currentPositionMs, isSameTrack, type PlaybackState, type Track } from "./playback";

const track = (uri: string, overrides: Partial<Track> = {}): Track => ({
  uri,
  title: "Song",
  artists: ["Artist"],
  album: "Album",
  artworkUrl: null,
  durationMs: 200_000,
  ...overrides,
});

describe("isSameTrack", () => {
  it("URI が同じなら同じ曲とみなす", () => {
    expect(isSameTrack(track("spotify:track:a"), track("spotify:track:a", { title: "x" }))).toBe(
      true,
    );
  });

  it("URI が違えば別の曲", () => {
    expect(isSameTrack(track("spotify:track:a"), track("spotify:track:b"))).toBe(false);
  });

  it("どちらかが null なら両方 null のときだけ同じ", () => {
    expect(isSameTrack(null, null)).toBe(true);
    expect(isSameTrack(track("spotify:track:a"), null)).toBe(false);
    expect(isSameTrack(null, track("spotify:track:a"))).toBe(false);
  });
});

describe("currentPositionMs", () => {
  const base: PlaybackState = {
    track: track("spotify:track:a"),
    paused: false,
    positionMs: 10_000,
    durationMs: 200_000,
    updatedAt: 1_000_000,
  };

  it("再生中は経過時間を加算する", () => {
    expect(currentPositionMs(base, 1_005_000)).toBe(15_000);
  });

  it("一時停止中は位置を進めない", () => {
    expect(currentPositionMs({ ...base, paused: true }, 1_005_000)).toBe(10_000);
  });

  it("duration を超えない", () => {
    expect(currentPositionMs(base, 2_000_000)).toBe(200_000);
  });
});
