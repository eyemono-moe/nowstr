import { describe, expect, it } from "vite-plus/test";
import { toPlaybackState } from "./mapping";

const sdkTrack = (overrides: Partial<Spotify.Track> = {}): Spotify.Track =>
  ({
    album: {
      name: "Hello Nasty",
      uri: "spotify:album:x",
      images: [
        { url: "https://i.scdn.co/64", width: 64, height: 64 },
        { url: "https://i.scdn.co/640", width: 640, height: 640 },
        { url: "https://i.scdn.co/300", width: 300, height: 300 },
      ],
    },
    artists: [
      { name: "Beastie Boys", uri: "spotify:artist:a", url: "" },
      { name: "Guest", uri: "spotify:artist:b", url: "" },
    ],
    duration_ms: 230_000,
    id: "a",
    is_playable: true,
    name: "Intergalactic",
    uid: "u",
    uri: "spotify:track:a",
    media_type: "audio",
    type: "track",
    track_type: "audio",
    linked_from: { uri: null, id: null },
    ...overrides,
  }) as Spotify.Track;

const sdkState = (track: Spotify.Track | null, paused = false): Spotify.PlaybackState =>
  ({
    paused,
    position: 12_345,
    duration: 230_000,
    track_window: { current_track: track, previous_tracks: [], next_tracks: [] },
  }) as unknown as Spotify.PlaybackState;

describe("toPlaybackState", () => {
  it("SDK の state をアプリ共通表現に変換する", () => {
    expect(toPlaybackState(sdkState(sdkTrack(), true), 1000)).toEqual({
      track: {
        uri: "spotify:track:a",
        title: "Intergalactic",
        artists: ["Beastie Boys", "Guest"],
        album: "Hello Nasty",
        artworkUrl: "https://i.scdn.co/640",
        durationMs: 230_000,
      },
      paused: true,
      positionMs: 12_345,
      durationMs: 230_000,
      updatedAt: 1000,
    });
  });

  it("広告は track なしとして扱う", () => {
    expect(toPlaybackState(sdkState(sdkTrack({ type: "ad" })), 0).track).toBeNull();
  });

  it("current_track がなければ track は null", () => {
    expect(toPlaybackState(sdkState(null), 0).track).toBeNull();
  });
});
