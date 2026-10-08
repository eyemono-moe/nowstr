// Nowstr: Apple Music（music.apple.com）のページ側（MAIN world）で動く補助スクリプト。
//
// 再生中の曲の URL は DOM に出ていないが、ページが使っている MusicKit JS（window.MusicKit）の
// nowPlayingItem に、曲の共有用 URL（attributes.url）と ID がある（2026-10 時点）。
// これはページ側の JavaScript からしか読めないので、ここで読み取って <html data-nowstr-apple-url> に書き、
// sources/apple-music.js（拡張側）が読む。
// chrome.* は使えず、ページの外には何も送らない。

(() => {
  /**
   * @typedef {{
   *   id?: string,
   *   title?: string,
   *   attributes?: { url?: string, playParams?: { catalogId?: string } },
   * }} NowPlayingItem
   * @typedef {{ nowPlayingItem?: NowPlayingItem, storefrontId?: string }} MusicKitInstance
   */

  /**
   * @param {NowPlayingItem} item
   * @param {MusicKitInstance} music
   */
  const itemUrl = (item, music) => {
    const url = item.attributes?.url;
    if (url?.startsWith("https://music.apple.com/")) return url;
    // ライブラリの曲など、URL がない場合はカタログの ID から作る
    const id = item.attributes?.playParams?.catalogId ?? item.id;
    if (!id || !/^\d+$/.test(id)) return "";
    return `https://music.apple.com/${music.storefrontId ?? "us"}/song/${id}`;
  };

  const update = () => {
    let url = "";
    let title = "";
    try {
      /** @type {MusicKitInstance | undefined} */
      const music = /** @type {any} */ (window).MusicKit?.getInstance?.();
      const item = music?.nowPlayingItem;
      if (music && item) {
        url = itemUrl(item, music);
        title = item.title ?? "";
      }
    } catch {
      // 読めなければリンクなしで投稿する
    }
    const root = document.documentElement.dataset;
    // 曲名も書いておき、拡張側で mediaSession の曲名と一致するときだけ使う（切り替え直後の取り違え防止）
    if (root.nowstrAppleUrl !== url) root.nowstrAppleUrl = url;
    if (root.nowstrAppleTitle !== title) root.nowstrAppleTitle = title;
  };

  // 曲が変わったとき（main-world.js の "nowstr:media"）だけ読む。MusicKit の更新を待って、少し遅れても読み直す
  // （sources/apple-music.js が読み直す 50 / 500 / 2000 ミリ秒後より先に書いておく）
  /** @type {ReturnType<typeof setTimeout>[]} */
  let timers = [];
  document.addEventListener("nowstr:media", () => {
    for (const timer of timers) clearTimeout(timer);
    update();
    timers = [400, 1_800].map((ms) => setTimeout(update, ms));
  });
  update();
})();
