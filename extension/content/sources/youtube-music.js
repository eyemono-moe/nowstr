// Nowstr: YouTube Music（music.youtube.com）の MusicSourceAdapter。
//
// 曲名などと再生状態は共通処理（source.js）が mediaSession と <video> から読むので、ここでは次だけを補う。
// - 動画 ID: プレイヤーの getVideoData()（youtube-music-main.js が <html data-nowstr-video-id> に書く）。
//   取れなければ URL の ?v= やアートワークの URL から探す。ホームやプレイリストのページで再生していても動く
// - 限定公開・非公開か: これもプレイヤーから（<html data-nowstr-video-listed>）。該当すればリンクを出さない
// - 広告の再生中（.ad-showing）は曲として扱わない（mediaSession に広告の情報が入るため）

(() => {
  /** @param {readonly MediaImage[] | undefined} artwork */
  const idFromArtwork = (artwork) => {
    for (const image of artwork ?? []) {
      // MV のサムネイルは https://i.ytimg.com/vi/<id>/... の形
      const match = /\/vi(?:_webp)?\/([\w-]{11})\//.exec(image.src);
      if (match) return match[1] ?? null;
    }
    return null;
  };

  /** @typedef {{ id: string | null, unlisted: boolean }} VideoInfo */

  /**
   * プレイヤーから確実に分かった ID と公開範囲を、曲（曲名＋アーティスト）ごとに覚えておく。
   * ページを移動して一時的に取れなくなっても、同じ曲の URI やリンクの有無が変わらない（＝再投稿しない）ようにするため。
   * @type {Map<string, VideoInfo>}
   */
  const knownVideos = new Map();

  /**
   * @param {MediaMetadata} metadata
   * @returns {VideoInfo}
   */
  const videoInfo = (metadata) => {
    const key = `${metadata.title}\n${metadata.artist}`;
    const root = document.documentElement.dataset;
    // プレイヤーの情報は、曲名が mediaSession と一致するときだけ信用する（曲の切り替え直後は古いことがある）
    if (root.nowstrVideoId && root.nowstrVideoTitle === metadata.title) {
      // 公開範囲が分からないときは、これまでどおりリンクを出す
      const info = { id: root.nowstrVideoId, unlisted: root.nowstrVideoListed === "false" };
      knownVideos.set(key, info);
      return info;
    }
    return (
      knownVideos.get(key) ?? {
        id:
          new URLSearchParams(location.search).get("v") ??
          parseHref(
            document.querySelector("#movie_player a.ytp-title-link")?.getAttribute("href"),
          )?.searchParams.get("v") ??
          idFromArtwork(metadata.artwork),
        unlisted: false,
      }
    );
  };

  defineMusicSource({
    source: "youtube-music",
    read({ metadata }) {
      if (document.querySelector(".ad-showing") || !metadata?.title) return null;
      const { id, unlisted } = videoInfo(metadata);
      const query = `${metadata.title} ${metadata.artist ?? ""}`.trim();
      return {
        // ID が見つからない場合でも、検索結果へのリンクで代用する
        uri: id
          ? `https://music.youtube.com/watch?v=${encodeURIComponent(id)}`
          : `https://music.youtube.com/search?q=${encodeURIComponent(query)}`,
        // ID は曲の区別に使うので URI には入れたまま、Nowstr 側でリンクを出さないようにする
        unlisted,
      };
    },
  });
})();
