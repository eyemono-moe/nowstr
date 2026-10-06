// Nowstr: Nintendo Music（music.nintendo.com）のページ側（MAIN world）で動く補助スクリプト。
//
// 曲ごとの共有用 URL（/ja-JP/track/<id>/）はあるが、再生中の曲の ID は DOM に出ていない。
// 画面下の再生バーを描画している React の props に { id, name, game } 形式の曲の情報があるので（2026-10 時点）、
// ここで探して <html data-nowstr-nintendo-track> に書き、sources/nintendo-music.js（拡張側）が読む。
// 曲名は曲の一覧などにも出るので、mediaSession の曲名と同じ文字の要素のうち、いちばん画面の下にあるもの（再生バー）を使う。
// chrome.* は使えず、ページの外には何も送らない。

(() => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const MAX_ANCESTORS = 20;

  /**
   * 要素から React の fiber を親方向にたどり、props の中から曲名が一致する曲の情報を探す
   * @param {Element} element
   * @param {string} title
   * @returns {string | null}
   */
  const trackIdFromFiber = (element, title) => {
    const key = Object.keys(element).find((name) => name.startsWith("__reactFiber$"));
    /** @type {any} */
    let fiber = key ? /** @type {any} */ (element)[key] : undefined;
    for (let i = 0; fiber && i < MAX_ANCESTORS; i++, fiber = fiber.return) {
      const props = fiber.memoizedProps;
      if (!props || typeof props !== "object") continue;
      for (const value of Object.values(props)) {
        if (
          value &&
          typeof value === "object" &&
          typeof value.id === "string" &&
          UUID.test(value.id) &&
          value.name === title
        ) {
          return value.id;
        }
      }
    }
    return null;
  };

  const update = () => {
    const title = navigator.mediaSession.metadata?.title ?? "";
    let id = "";
    if (title) {
      try {
        const candidates = [...document.querySelectorAll("body *")]
          .filter(
            (element) => element.childElementCount === 0 && element.textContent?.trim() === title,
          )
          .map((element) => ({ element, top: element.getBoundingClientRect().top }))
          // 画面の下にあるもの（再生バー）から試す
          .sort((a, b) => b.top - a.top);
        for (const { element } of candidates) {
          const found = trackIdFromFiber(element, title);
          if (found) {
            id = found;
            break;
          }
        }
      } catch {
        // 読めなくても、拡張側はリンクなしで投稿する
      }
    }
    const root = document.documentElement.dataset;
    // 曲名も書いておき、拡張側で mediaSession の曲名と一致するときだけ使う（切り替え直後の取り違え防止）
    if (root.nowstrNintendoTrack !== id) root.nowstrNintendoTrack = id;
    if (root.nowstrNintendoTitle !== title) root.nowstrNintendoTitle = title;
  };

  // 曲が変わったとき（main-world.js の "nowstr:media"）だけ読む。再生バーの描画を待って、少し遅れても読み直す
  // （sources/nintendo-music.js が読み直す 50 / 500 / 2000 ミリ秒後より先に書いておく）
  /** @type {ReturnType<typeof setTimeout>[]} */
  let timers = [];
  document.addEventListener("nowstr:media", () => {
    for (const timer of timers) clearTimeout(timer);
    update();
    timers = [400, 1_800].map((ms) => setTimeout(update, ms));
  });
  update();
})();
