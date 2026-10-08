// Nowstr: Apple Music（music.apple.com）の MusicSourceAdapter。
//
// Apple Music は mediaSession の metadata を設定し、再生は document 内の <audio> で行うので、
// 曲名・再生状態・位置・長さは共通処理（source.js）で読める（2026-10 時点）。ここでは次だけを補う。
// - 曲の URL: apple-music-main.js が MusicKit の nowPlayingItem から読んだ URL（<html data-nowstr-apple-url>）。
//   見つからなければ、曲の区別だけに使う URL にして、リンクは出さない
// サインインしていないときは 30 秒の試聴になるが、そのまま投稿する（長さは試聴の長さになる）。

(() => {
  defineMusicSource({
    source: "apple-music",
    read({ metadata }) {
      if (!metadata?.title) return null;
      const root = document.documentElement.dataset;
      const url = root.nowstrAppleTitle === metadata.title ? root.nowstrAppleUrl : "";
      return {
        uri:
          url ||
          `https://music.apple.com/#${encodeURIComponent(`${metadata.title}\n${metadata.artist ?? ""}`)}`,
        unlisted: !url,
      };
    },
  });
})();
