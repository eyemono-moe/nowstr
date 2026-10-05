// Nowstr: Amazon Music（music.amazon.co.jp / music.amazon.com など）の MusicSourceAdapter。
//
// Amazon Music は mediaSession の metadata と playbackState を設定する。再生は document に入れない <audio> で行うが、
// main-world.js が拾うので、曲名・再生状態・位置・長さは共通処理（source.js）で読める（2026-10 にポッドキャストで確認）。
// ここでは次だけを補う。
// - 曲の URL: 再生バーにも DOM にも曲（ASIN）へのリンクがないので、曲名とアーティストでの検索結果の URL にする
// - 広告: 再生バーの曲情報（#transport music-horizontal-item）の primary-href が "#" 以外のときは広告とみなす
//   （通常の曲・エピソードは "#"。web-scrobbler の Amazon connector と同じ判定）

(() => {
  const isAd = () => {
    const item = document.querySelector("#transport music-horizontal-item");
    const href = item?.getAttribute("primary-href");
    return href !== undefined && href !== null && href !== "#";
  };

  defineMusicSource({
    source: "amazon-music",
    read({ metadata }) {
      if (!metadata?.title || isAd()) return null;
      const query = `${metadata.title} ${metadata.artist ?? ""}`.trim();
      return {
        // music.amazon.co.jp など、いま開いている国のサイトの検索結果にする
        uri: `${location.origin}/search/${encodeURIComponent(query)}`,
        // ポッドキャストでは album に曲名（エピソード名）が入るので出さない
        ...(metadata.album === metadata.title ? { album: "" } : {}),
      };
    },
  });
})();
