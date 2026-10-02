import { describe, expect, it } from "vite-plus/test";
import { buildClearMusicStatusEvent, buildMusicStatusEvent, MUSIC_STATUS_KIND } from "./nip38";

describe("buildMusicStatusEvent", () => {
  it("NIP-38 の music status event を組み立てる", () => {
    const event = buildMusicStatusEvent(
      {
        trackUri: "spotify:track:6rqhFgbbKwnb9MLmUQDhG6",
        content: "Intergalactic - Beastie Boys",
        expiresAt: 1_692_845_589,
      },
      1_692_845_400,
    );
    expect(event).toEqual({
      kind: 30315,
      created_at: 1_692_845_400,
      content: "Intergalactic - Beastie Boys",
      tags: [
        ["d", "music"],
        ["r", "spotify:track:6rqhFgbbKwnb9MLmUQDhG6"],
        ["expiration", "1692845589"],
      ],
    });
  });
});

describe("buildClearMusicStatusEvent", () => {
  it("content を空にした music status で clear する", () => {
    expect(buildClearMusicStatusEvent(1_692_845_400)).toEqual({
      kind: MUSIC_STATUS_KIND,
      created_at: 1_692_845_400,
      content: "",
      tags: [["d", "music"]],
    });
  });
});
