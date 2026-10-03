// Nowstr Bridge: music.youtube.com で再生中の曲を読み取る content script。
//
// - 曲名・アーティスト・アルバム・アートワーク: navigator.mediaSession.metadata
//   （YouTube Music が OS のメディア操作のために設定している情報）
// - 再生中か・再生位置・長さ: ページ内の <video> 要素
// - 動画 ID: プレイヤーの getVideoData()（youtube-music-main.js が <html data-nowstr-video-id> に書く）。
//   取れなければ URL の ?v= やアートワークの URL から探す。ホームやプレイリストのページで再生していても動く
//
// 読み取った情報は拡張の service worker 経由で Nowstr のタブにだけ渡し、どこにも保存しない。

(() => {
  const HEARTBEAT_MS = 15_000;
  const POLL_MS = 1_000;

  // 拡張の更新などで二重に動かないよう、先に動いていたものを止める
  window.__nowstrYtmStop?.();
  let stopped = false;

  /** @type {chrome.runtime.Port | null} */
  let port = null;
  let lastKey = "";
  let lastSentAt = 0;
  /** @type {BridgePlaybackState | null} */
  let lastState = null;

  const connect = () => {
    // 拡張が更新・削除されたあとは何もしない
    if (stopped || !chrome.runtime?.id) return;
    port = chrome.runtime.connect({ name: "ytm" });
    port.onDisconnect.addListener(() => {
      port = null;
      setTimeout(connect, 1_000);
    });
    lastKey = "";
    report();
  };

  /** @param {string | null | undefined} href */
  const idFromHref = (href) => {
    if (!href) return null;
    try {
      return new URL(href, location.href).searchParams.get("v");
    } catch {
      return null;
    }
  };

  /** @param {readonly MediaImage[] | undefined} artwork */
  const idFromArtwork = (artwork) => {
    for (const image of artwork ?? []) {
      // MV のサムネイルは https://i.ytimg.com/vi/<id>/... の形
      const match = /\/vi(?:_webp)?\/([\w-]{11})\//.exec(image.src);
      if (match) return match[1] ?? null;
    }
    return null;
  };

  /**
   * プレイヤーから確実に分かった ID を、曲（曲名＋アーティスト）ごとに覚えておく。
   * ページを移動して一時的に ID が取れなくなっても、同じ曲の URI が変わらない（＝再投稿しない）ようにするため。
   * @type {Map<string, string>}
   */
  const knownIds = new Map();

  /** @param {MediaMetadata} metadata */
  const videoId = (metadata) => {
    const key = `${metadata.title}\n${metadata.artist}`;
    const root = document.documentElement.dataset;
    // プレイヤーの情報は、曲名が mediaSession と一致するときだけ信用する（曲の切り替え直後は古いことがある）
    if (root.nowstrVideoId && root.nowstrVideoTitle === metadata.title) {
      knownIds.set(key, root.nowstrVideoId);
      return root.nowstrVideoId;
    }
    return (
      knownIds.get(key) ??
      new URLSearchParams(location.search).get("v") ??
      idFromHref(document.querySelector("#movie_player a.ytp-title-link")?.getAttribute("href")) ??
      idFromArtwork(metadata.artwork)
    );
  };

  /** @param {readonly MediaImage[] | undefined} artwork */
  const largestArtwork = (artwork) => {
    /** @type {{ src: string, size: number } | null} */
    let best = null;
    for (const image of artwork ?? []) {
      const size = Number.parseInt(String(image.sizes ?? "0").split("x")[0], 10) || 0;
      if (!best || size > best.size) best = { src: image.src, size };
    }
    return best?.src?.startsWith("https://") ? best.src : null;
  };

  /** @returns {BridgePlaybackState | null} */
  const readState = () => {
    const video = document.querySelector("video");
    const metadata = navigator.mediaSession?.metadata;
    // 広告の再生中は曲として扱わない（mediaSession に広告の情報が入るため）
    if (document.querySelector(".ad-showing") || !video || !metadata?.title) return null;
    const durationMs = Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : 0;
    if (durationMs <= 0) return null;
    const id = videoId(metadata);
    const query = `${metadata.title} ${metadata.artist ?? ""}`.trim();
    return {
      track: {
        // ID が見つからない場合でも、検索結果へのリンクで代用する
        uri: id
          ? `https://music.youtube.com/watch?v=${encodeURIComponent(id)}`
          : `https://music.youtube.com/search?q=${encodeURIComponent(query)}`,
        title: metadata.title,
        artists: metadata.artist ? [metadata.artist] : [],
        album: metadata.album ?? "",
        artworkUrl: largestArtwork(metadata.artwork),
        durationMs,
      },
      paused: video.paused || video.ended,
      positionMs: Math.round(video.currentTime * 1000),
      durationMs,
      updatedAt: Date.now(),
    };
  };

  /**
   * 位置が「経過時間ぶん進んだだけ」でなければ seek とみなす
   * @param {BridgePlaybackState | null} prev
   * @param {BridgePlaybackState | null} next
   */
  const seeked = (prev, next) => {
    if (!prev || !next || prev.paused || next.paused) return false;
    const expected = prev.positionMs + (next.updatedAt - prev.updatedAt);
    return Math.abs(next.positionMs - expected) > 3_000;
  };

  const report = () => {
    if (!chrome.runtime?.id) {
      stop();
    }
    if (stopped || !port) return;
    const state = readState();
    const track = state?.track;
    const key =
      state && track
        ? [track.uri, track.title, track.artists.join(","), state.paused, state.durationMs].join(
            "|",
          )
        : "none";
    const now = Date.now();
    if (key === lastKey && now - lastSentAt < HEARTBEAT_MS && !seeked(lastState, state)) {
      lastState = state;
      return;
    }
    lastKey = key;
    lastSentAt = now;
    lastState = state;
    try {
      port.postMessage({ type: "playback", state });
    } catch {
      port = null;
    }
  };

  const onMediaEvent = () => setTimeout(report, 50);
  const MEDIA_EVENTS = ["play", "pause", "ended", "seeked", "loadedmetadata", "durationchange"];
  // media 要素のイベントはバブリングしないので capture で拾う
  for (const type of MEDIA_EVENTS) document.addEventListener(type, onMediaEvent, true);
  const timer = setInterval(report, POLL_MS);

  function stop() {
    stopped = true;
    clearInterval(timer);
    for (const type of MEDIA_EVENTS) document.removeEventListener(type, onMediaEvent, true);
    try {
      port?.disconnect();
    } catch {
      // 拡張が更新済みで切断できないことがある
    }
    port = null;
  }
  window.__nowstrYtmStop = stop;

  connect();
})();
