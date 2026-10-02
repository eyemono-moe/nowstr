import { describe, expect, it } from "vite-plus/test";
import { spotifyWebUrl } from "./spotify-link";

describe("spotifyWebUrl", () => {
  it("track / episode の URI を open.spotify.com の URL に変換する", () => {
    expect(spotifyWebUrl("spotify:track:6rqhFgbbKwnb9MLmUQDhG6")).toBe(
      "https://open.spotify.com/track/6rqhFgbbKwnb9MLmUQDhG6",
    );
    expect(spotifyWebUrl("spotify:episode:abc123")).toBe("https://open.spotify.com/episode/abc123");
  });

  it("ローカルファイル等、リンクできない URI は null", () => {
    expect(spotifyWebUrl("spotify:local:Artist:Album:Title:180")).toBeNull();
    expect(spotifyWebUrl("not-a-uri")).toBeNull();
  });
});
