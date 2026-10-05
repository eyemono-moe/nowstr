// Nowstr: Spotify Web Player（open.spotify.com）のページ側（MAIN world）で動く補助スクリプト。
//
// 再生バーのリンクは /album/<id> だけで、いま再生中の曲（track）の ID は DOM に出ていない（2026-10 時点）。
// 曲の ID は再生バーを描画している React の props（spotify:track:<id> 形式の uri）にあるが、
// これはページ側の JavaScript からしか読めないので、ここで探して <html data-nowstr-spotify-uri> に書き、
// sources/spotify.js（拡張側）が読む。
// props の形は Spotify の更新で変わりうるので、決まった経路はたどらず「uri の形をした文字列」を探す。
// chrome.* は使えず、ページの外には何も送らない。

(() => {
  const URI = /^spotify:(?:track|episode):[A-Za-z0-9]{22}$/;
  const BAR = '[data-testid="now-playing-bar"]';
  const MAX_DEPTH = 3;
  const MAX_ANCESTORS = 25;

  /**
   * props の中から uri の形をした文字列を探す（深さと訪問数を制限する）
   * @param {unknown} value
   * @param {number} depth
   * @param {Set<unknown>} seen
   * @returns {string | null}
   */
  const search = (value, depth, seen) => {
    if (typeof value === "string") return URI.test(value) ? value : null;
    if (!value || typeof value !== "object" || depth > MAX_DEPTH || seen.has(value)) return null;
    if (value instanceof Node || seen.size > 2_000) return null;
    seen.add(value);
    for (const key of Object.keys(value)) {
      // React の子要素や内部の参照はたどらない
      if (key === "children" || key === "_owner" || key.startsWith("_")) continue;
      let child;
      try {
        child = /** @type {Record<string, unknown>} */ (value)[key];
      } catch {
        continue;
      }
      const found = search(child, depth + 1, seen);
      if (found) return found;
    }
    return null;
  };

  /**
   * 曲名のリンクから React の fiber を親方向にたどり、その props から uri を探す
   * @param {Element} element
   */
  const uriFromFiber = (element) => {
    const key = Object.keys(element).find((name) => name.startsWith("__reactFiber$"));
    /** @type {{ memoizedProps?: unknown, return?: unknown } | undefined} */
    let fiber = key ? /** @type {any} */ (element)[key] : undefined;
    const seen = new Set();
    for (let i = 0; fiber && i < MAX_ANCESTORS; i++) {
      const found = search(fiber.memoizedProps, 0, seen);
      if (found) return found;
      fiber = /** @type {any} */ (fiber.return);
    }
    return null;
  };

  const update = () => {
    const link = document.querySelector(`${BAR} [data-testid="context-item-link"]`);
    const root = document.documentElement.dataset;
    let uri = "";
    try {
      uri = (link && uriFromFiber(link)) ?? "";
    } catch {
      // 読めなくても、拡張側はアルバムのリンクで代用する
    }
    // 曲名も書いておき、拡張側で mediaSession の曲名と一致するときだけ使う（切り替え直後の取り違え防止）
    const title = link?.textContent?.trim() ?? "";
    if (root.nowstrSpotifyUri !== uri) root.nowstrSpotifyUri = uri;
    if (root.nowstrSpotifyTitle !== title) root.nowstrSpotifyTitle = title;
  };

  // 曲が変わったとき（main-world.js の "nowstr:media"）だけ読む。再生バーの描画を待って、少し遅れても読み直す
  // （sources/spotify.js が読み直す 50 / 500 / 2000 ミリ秒後より先に書いておく）
  /** @type {ReturnType<typeof setTimeout>[]} */
  let timers = [];
  document.addEventListener("nowstr:media", () => {
    for (const timer of timers) clearTimeout(timer);
    update();
    timers = [400, 1_800].map((ms) => setTimeout(update, ms));
  });
  update();
})();
