import { describe, expect, it } from "vite-plus/test";
import manifest from "../manifest.json";
import { contentScriptsFor, matchesUrl, serviceForUrl, SERVICES } from "./services";

describe("matchesUrl", () => {
  it("ホストが一致する URL だけに当てはまる", () => {
    expect(matchesUrl("https://music.youtube.com/*", "https://music.youtube.com/watch?v=a")).toBe(
      true,
    );
    expect(matchesUrl("https://music.youtube.com/*", "https://www.youtube.com/watch?v=a")).toBe(
      false,
    );
    expect(matchesUrl("https://music.youtube.com/*", "http://music.youtube.com/")).toBe(false);
    expect(matchesUrl("https://music.youtube.com/*", "not a url")).toBe(false);
  });
});

describe("serviceForUrl", () => {
  it("URL からサービスを求める", () => {
    expect(serviceForUrl("https://music.amazon.co.jp/albums/x")?.id).toBe("amazon-music");
    expect(serviceForUrl("https://open.spotify.com/")?.id).toBe("spotify");
    expect(serviceForUrl("https://music.apple.com/jp/album/x/1")?.id).toBe("apple-music");
    expect(serviceForUrl("https://example.com/")).toBeNull();
    expect(serviceForUrl(undefined)).toBeNull();
  });
});

describe("contentScriptsFor", () => {
  it("共通のスクリプトとサービスごとのスクリプトを、決まった順で入れる", () => {
    const youtube = SERVICES.find((service) => service.id === "youtube-music")!;
    expect(
      contentScriptsFor(youtube).map((script) => [script.id, script.world ?? "ISOLATED"]),
    ).toEqual([
      ["youtube-music:main-world", "MAIN"],
      ["youtube-music:main", "MAIN"],
      ["youtube-music:adapter", "ISOLATED"],
    ]);
  });

  it("id はサービス間で重ならない", () => {
    const ids = SERVICES.flatMap((service) =>
      contentScriptsFor(service).map((script) => script.id),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("manifest", () => {
  it("optional_host_permissions は、対応サービスのサイトと一致する（追加し忘れると許可を求められない）", () => {
    expect([...manifest.optional_host_permissions].sort()).toEqual(
      SERVICES.flatMap((service) => service.matches).sort(),
    );
  });

  it("サイトの権限を最初から求めない（サービスごとにポップアップで許可する）", () => {
    expect("host_permissions" in manifest).toBe(false);
    expect("content_scripts" in manifest).toBe(false);
  });
});
