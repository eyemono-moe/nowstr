// Nowstr: Nintendo Music（music.nintendo.com）の MusicSourceAdapter。
//
// mediaSession には曲名（title）とゲーム名（album）が入り、artist は空（2026-10 時点）。
// 再生は document 内の <audio> で行うので、再生状態は共通処理（source.js）で読める。ここでは次だけを補う。
// - 曲の URL: nintendo-music-main.js が再生バーの React の props から見つけた曲の ID で、
//   「共有用リンクをコピー」と同じ形の URL（/shared/<言語>/<国>/tracks/<id>/）にする。見つからなければリンクを付けない
// - アーティスト: 空なので、ゲーム名を使う（「曲名 - ゲーム名」と投稿する）

(() => {
  /** /ja-JP/... の言語の部分。分からなければ ja-JP */
  const locale = () => /^\/([a-z]{2}-[A-Z]{2})(?:\/|$)/.exec(location.pathname)?.[1] ?? "ja-JP";

  defineMusicSource({
    source: "nintendo-music",
    read({ metadata }) {
      if (!metadata?.title) return null;
      const root = document.documentElement.dataset;
      const id = root.nowstrNintendoTitle === metadata.title ? root.nowstrNintendoTrack : "";
      const game = metadata.album ?? "";
      const lang = locale();
      // 国は言語の地域の部分（ja-JP → JP）
      const country = lang.split("-")[1] ?? "JP";
      return {
        // ID が分からないときは、曲の区別だけに使う URL にして、リンクは出さない
        uri: id
          ? `https://music.nintendo.com/shared/${lang}/${country}/tracks/${id}/`
          : `https://music.nintendo.com/${lang}/#${encodeURIComponent(`${metadata.title}\n${game}`)}`,
        unlisted: !id,
        artists: metadata.artist ? [metadata.artist] : game ? [game] : [],
        album: game,
      };
    },
  });
})();
