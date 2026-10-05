// Nowstr: 音楽サービスのページ側（MAIN world）で動く共通スクリプト。どのサービスでも同じものを使う。
//
// 1. 再生中の media 要素の状態（再生中か・位置・長さ）を <html data-nowstr-media> に JSON で書く。
//    SoundCloud・Spotify のように document に入れない <audio> / <video> で再生するサービスがあり、
//    拡張側（isolated world）からは見つけられないため、HTMLMediaElement.prototype.play を包んで、再生された要素をここで覚えておく。
//    mediaSession.setPositionState は読み戻せず、呼ばないサービス・引数なしで呼ぶサービスもあるので使わない。
// 2. 状態が変わったら document に "nowstr:media" イベントを出す（ポーリングはしない）。
//    - media 要素のイベント（再生・一時停止・seek・曲の読み込みなど）
//    - mediaSession.metadata / playbackState への代入と、MediaMetadata の書き換え（曲の切り替え）
//    再生位置は「書いた時刻（at）」と一緒に書くので、読む側で経過時間ぶん進められる。
// 3. service worker から頼まれた NIP-07（window.nostr）の呼び出しを中継する。
//    window.nostr は NIP-07 拡張がページ側に入れるもので、拡張の service worker からは使えないため。
//    受け渡しは document の CustomEvent（detail は JSON 文字列）で行う。ページ側のスクリプトからも見えるので、
//    返ってきた署名は service worker 側で検証する。
//
// chrome.* は使えず、ページの外には何も送らない。document_start で動かし、ページより先に包む。

(() => {
  const STATE = "__nowstrMedia";

  /**
   * 拡張を更新すると、新しいスクリプトが同じページにもう一度注入される。
   * 包み直しを重ねないよう、包むのは一度だけにして、中で呼ぶ処理（onPlay / onChange）だけを差し替える。
   * @type {{ onPlay: (element: HTMLMediaElement) => void, onChange: () => void, stop?: () => void }}
   */
  const shared = /** @type {any} */ (window)[STATE] ?? { onPlay: () => {}, onChange: () => {} };
  if (!(/** @type {any} */ (window)[STATE])) {
    /** @type {any} */ (window)[STATE] = shared;
    /** ページの動作は止めない */
    const safely = (/** @type {() => void} */ fn) => {
      try {
        fn();
      } catch {
        // noop
      }
    };

    // oxlint-disable-next-line unbound-method -- 下で this を渡して呼ぶ
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      safely(() => shared.onPlay(this));
      return play.call(this);
    };

    /**
     * setter を包んで、代入されたら onChange を呼ぶ
     * @param {object} proto
     * @param {string[]} names
     */
    const watchSetters = (proto, names) => {
      for (const name of names) {
        const descriptor = Object.getOwnPropertyDescriptor(proto, name);
        // oxlint-disable-next-line unbound-method -- 下で this を渡して呼ぶ
        const set = descriptor?.set;
        if (!descriptor || !set) continue;
        Object.defineProperty(proto, name, {
          ...descriptor,
          set(value) {
            set.call(this, value);
            safely(() => shared.onChange());
          },
        });
      }
    };
    watchSetters(MediaSession.prototype, ["metadata", "playbackState"]);
    watchSetters(MediaMetadata.prototype, ["title", "artist", "album", "artwork"]);
  }
  shared.stop?.();

  /** @type {Map<HTMLMediaElement, number>} 要素 → 最後に再生を始めた時刻 */
  const elements = new Map();
  const MEDIA_EVENTS = [
    "play",
    "playing",
    "pause",
    "ended",
    "seeked",
    "ratechange",
    "durationchange",
    "loadedmetadata",
    "emptied",
  ];

  const notify = () => {
    write();
    document.dispatchEvent(new CustomEvent("nowstr:media"));
  };

  /** @param {HTMLMediaElement} element */
  const track = (element) => {
    if (!elements.has(element)) {
      for (const type of MEDIA_EVENTS) element.addEventListener(type, notify);
    }
    elements.set(element, Date.now());
  };

  /** 再生中のものを優先し、なければ最後に再生を始めたもの */
  const active = () => {
    for (const element of document.querySelectorAll("video, audio")) {
      if (!elements.has(/** @type {HTMLMediaElement} */ (element))) {
        track(/** @type {HTMLMediaElement} */ (element));
      }
    }
    /** @type {HTMLMediaElement | null} */
    let best = null;
    let bestScore = -1;
    for (const [element, at] of elements) {
      if (!element.isConnected && !element.currentSrc && !element.srcObject) {
        // 捨てられた要素は覚えておかない
        elements.delete(element);
        continue;
      }
      const usable = Number.isFinite(element.duration) && element.duration > 0;
      if (!usable) continue;
      const score = (element.paused ? 0 : 1e15) + at;
      if (score > bestScore) {
        best = element;
        bestScore = score;
      }
    }
    return best;
  };

  const write = () => {
    const element = active();
    const value = element
      ? JSON.stringify({
          paused: element.paused || element.ended,
          positionMs: Math.round(element.currentTime * 1000),
          durationMs: Math.round(element.duration * 1000),
          at: Date.now(),
        })
      : "";
    if (document.documentElement.dataset.nowstrMedia !== value) {
      document.documentElement.dataset.nowstrMedia = value;
    }
  };

  shared.onPlay = (element) => {
    track(element);
    setTimeout(notify, 0);
  };
  shared.onChange = () => setTimeout(notify, 0);

  /**
   * @param {string} id
   * @param {{ result: unknown } | { error: string }} payload
   */
  const respond = (id, payload) =>
    document.dispatchEvent(
      new CustomEvent("nowstr:nip07-response", { detail: JSON.stringify({ id, ...payload }) }),
    );

  /** NIP-07 拡張は window.nostr を非同期に入れるので、少し待つ */
  const waitForNostr = async () => {
    for (let i = 0; i < 30; i++) {
      const nostr = /** @type {any} */ (window).nostr;
      if (nostr && typeof nostr.signEvent === "function") return nostr;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return null;
  };

  /** @param {Event} event */
  const onRequest = async (event) => {
    const detail = /** @type {CustomEvent} */ (event).detail;
    /** @type {{ id?: unknown, method?: unknown, params?: unknown }} */
    let request;
    try {
      request = JSON.parse(String(detail));
    } catch {
      return;
    }
    const { id, method, params } = request;
    if (typeof id !== "string") return;
    const nostr = await waitForNostr();
    if (!nostr) {
      respond(id, { error: "unavailable" });
      return;
    }
    try {
      if (method === "getPublicKey") {
        respond(id, { result: await nostr.getPublicKey() });
      } else if (method === "signEvent") {
        respond(id, { result: await nostr.signEvent(params) });
      } else {
        respond(id, { error: "unknown method" });
      }
    } catch (error) {
      respond(id, { error: error instanceof Error ? error.message : String(error) || "rejected" });
    }
  };
  document.addEventListener("nowstr:nip07-request", onRequest);

  shared.stop = () => {
    document.removeEventListener("nowstr:nip07-request", onRequest);
    for (const element of elements.keys()) {
      for (const type of MEDIA_EVENTS) element.removeEventListener(type, notify);
    }
    elements.clear();
  };

  // 拡張を入れ直したときなど、すでに再生中のページでも document 内の要素は拾える
  notify();
})();
