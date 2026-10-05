// Nowstr: Spotify Web Player（open.spotify.com）の MusicSourceAdapter。
// Web Playback SDK や Web API は使わず、Web Player の画面から読むので、Spotify Free でも使える。
//
// 曲名などは共通処理（source.js）が mediaSession から、再生状態は document 外の media 要素から読む。
// ここでは次だけを補う。
// - 曲の URL: spotify-main.js が React の props から見つけた spotify:track:<id>（<html data-nowstr-spotify-uri>）。
//   見つからなければ、再生バーの曲名のリンク（/album/<id>）で代用する
// - 曲かどうか: アーティストのリンクが /artist/（ポッドキャストは /show/）を指しているときだけ曲として扱う。
//   Spotify Free の広告や、リンクのないローカルファイルで status を出さないため（web-scrobbler と同じ判定）
// - 再生位置・長さ: media 要素が見つからないときだけ、再生バーの表示（m:ss）から読む

(() => {
  const BAR = '[data-testid="now-playing-bar"]';
  // /intl-ja/album/<id> のように、言語の接頭辞が付くことがある
  const PATH = /^(?:\/intl-[\w-]+)?\/(track|episode|album|artist|show)\/([A-Za-z0-9]{22})$/;

  /** @param {string | null | undefined} href */
  const spotifyPath = (href) => {
    const url = parseHref(href);
    const match = url ? PATH.exec(url.pathname) : null;
    return match ? { type: match[1] ?? "", id: match[2] ?? "" } : null;
  };

  /** @param {string} title mediaSession の曲名 */
  const itemUrl = (title) => {
    const root = document.documentElement.dataset;
    const uri = /^spotify:(track|episode):([A-Za-z0-9]{22})$/.exec(root.nowstrSpotifyUri ?? "");
    if (uri && root.nowstrSpotifyTitle === title) {
      return `https://open.spotify.com/${uri[1]}/${uri[2]}`;
    }
    const link = spotifyPath(
      document.querySelector(`${BAR} [data-testid="context-item-link"]`)?.getAttribute("href"),
    );
    return link ? `https://open.spotify.com/${link.type}/${link.id}` : null;
  };

  const isMusic = () => {
    const artist = spotifyPath(
      document
        .querySelector(`${BAR} [data-testid="context-item-info-artist"]`)
        ?.getAttribute("href"),
    );
    return artist?.type === "artist" || artist?.type === "show";
  };

  /**
   * "3:33" / "1:02:03" をミリ秒にする。"-0:42"（残り時間の表示）は負の値になる
   * @param {string | null | undefined} text
   */
  const clockMs = (text) => {
    const match = /^(-?)((?:\d+:)?\d+:\d{2})$/.exec(text?.trim() ?? "");
    if (!match) return null;
    const seconds = (match[2] ?? "").split(":").reduce((sum, part) => sum * 60 + Number(part), 0);
    return (match[1] ? -1 : 1) * seconds * 1000;
  };

  /** 再生バーの表示から読む位置と長さ */
  const barTime = () => {
    const position = clockMs(
      document.querySelector(`${BAR} [data-testid="playback-position"]`)?.textContent,
    );
    const duration = clockMs(
      document.querySelector(`${BAR} [data-testid="playback-duration"]`)?.textContent,
    );
    if (position === null || duration === null) return {};
    // 残り時間の表示に切り替えている場合
    return { positionMs: position, durationMs: duration < 0 ? position - duration : duration };
  };

  defineMusicSource({
    source: "spotify",
    read({ metadata, media }) {
      if (!metadata?.title || !isMusic()) return null;
      const uri = itemUrl(metadata.title);
      if (!uri) return null;
      return { uri, ...(media ? {} : barTime()) };
    },
  });
})();
