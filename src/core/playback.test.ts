import { describe, expect, it } from "vite-plus/test";
import { isSameTrack, type Track } from "./playback";

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
