import { describe, expect, it } from "vite-plus/test";
import { EXTENSION_MESSAGE_TAG, parseExtensionMessage } from "./extension-protocol";

const track = {
  uri: "https://music.youtube.com/watch?v=abc",
  title: "Intergalactic",
  artists: ["Beastie Boys"],
  album: "Hello Nasty",
  artworkUrl: "https://lh3.googleusercontent.com/x",
  durationMs: 230_000,
};

describe("parseExtensionMessage", () => {
  it("hello を読む", () => {
    expect(
      parseExtensionMessage({
        [EXTENSION_MESSAGE_TAG]: "extension",
        type: "hello",
        version: "0.1.0",
      }),
    ).toEqual({ type: "hello", version: "0.1.0" });
  });

  it("playback を PlaybackState として読む", () => {
    const state = { track, paused: false, positionMs: 1_000, durationMs: 230_000, updatedAt: 5 };
    expect(
      parseExtensionMessage({ [EXTENSION_MESSAGE_TAG]: "extension", type: "playback", state }),
    ).toEqual({ type: "playback", state });
  });

  it("限定公開・非公開かどうかを読む", () => {
    const state = {
      track: { ...track, unlisted: true },
      paused: false,
      positionMs: 1_000,
      durationMs: 230_000,
      updatedAt: 5,
    };
    expect(
      parseExtensionMessage({ [EXTENSION_MESSAGE_TAG]: "extension", type: "playback", state }),
    ).toEqual({ type: "playback", state });
    const bad = { ...state, track: { ...track, unlisted: "yes" } };
    expect(
      parseExtensionMessage({ [EXTENSION_MESSAGE_TAG]: "extension", type: "playback", state: bad }),
    ).toBeNull();
  });

  it("再生していなければ state は null", () => {
    expect(
      parseExtensionMessage({
        [EXTENSION_MESSAGE_TAG]: "extension",
        type: "playback",
        state: null,
      }),
    ).toEqual({ type: "playback", state: null });
  });

  it("track がない state は track: null として扱う", () => {
    const state = { track: null, paused: true, positionMs: 0, durationMs: 0, updatedAt: 1 };
    expect(
      parseExtensionMessage({ [EXTENSION_MESSAGE_TAG]: "extension", type: "playback", state }),
    ).toEqual({ type: "playback", state });
  });

  it("Nowstr の拡張以外からのメッセージや壊れた値は無視する", () => {
    expect(parseExtensionMessage({ type: "playback", state: null })).toBeNull();
    expect(parseExtensionMessage("hello")).toBeNull();
    expect(
      parseExtensionMessage({
        [EXTENSION_MESSAGE_TAG]: "extension",
        type: "playback",
        state: {
          track: { ...track, artists: "Beastie Boys" },
          paused: false,
          positionMs: 0,
          durationMs: 1,
          updatedAt: 1,
        },
      }),
    ).toBeNull();
    expect(
      parseExtensionMessage({
        [EXTENSION_MESSAGE_TAG]: "extension",
        type: "playback",
        state: { track, paused: "no", positionMs: 0, durationMs: 1, updatedAt: 1 },
      }),
    ).toBeNull();
  });

  it("track の URI は YouTube Music の https URL だけを受け付ける", () => {
    const bad = { ...track, uri: "javascript:alert(1)" };
    expect(
      parseExtensionMessage({
        [EXTENSION_MESSAGE_TAG]: "extension",
        type: "playback",
        state: { track: bad, paused: false, positionMs: 0, durationMs: 1, updatedAt: 1 },
      }),
    ).toBeNull();
  });
});
