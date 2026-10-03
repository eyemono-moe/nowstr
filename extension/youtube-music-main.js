// Nowstr Bridge: music.youtube.com のページ側（MAIN world）で動く補助スクリプト。
//
// 再生中の動画 ID は、URL（?v=）には常に出ているとは限らない（ホームやプレイリストのページで再生している場合など）。
// YouTube のプレイヤーは getVideoData() で再生中の動画 ID を返すが、これはページ側の JavaScript にしかない。
// そのため、ここで読み取って <html data-nowstr-video-id> に書き、youtube-music.js（拡張側）が読む。
// chrome.* は使えず、ページの外には何も送らない。

(() => {
  /** @typedef {HTMLElement & { getVideoData?: () => { video_id?: string, title?: string } | undefined }} YouTubePlayer */

  const update = () => {
    const player = /** @type {YouTubePlayer | null} */ (document.getElementById("movie_player"));
    const data = player?.getVideoData?.();
    if (!data?.video_id) return;
    const root = document.documentElement.dataset;
    // 曲名も書いておき、拡張側で mediaSession の曲名と一致するときだけ ID を使う（切り替え直後の取り違え防止）
    if (root.nowstrVideoId !== data.video_id) root.nowstrVideoId = data.video_id;
    if (root.nowstrVideoTitle !== (data.title ?? "")) root.nowstrVideoTitle = data.title ?? "";
  };

  // 曲が切り替わった直後に youtube-music.js が読む前に更新しておく
  for (const type of ["loadedmetadata", "durationchange", "play"]) {
    document.addEventListener(type, update, true);
  }
  setInterval(update, 1_000);
  update();
})();
