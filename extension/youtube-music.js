// Nowstr Bridge: music.youtube.com で再生中の曲を読み取る content script。
//
// - 曲名・アーティスト・アルバム・アートワーク: navigator.mediaSession.metadata
//   （YouTube Music が OS のメディア操作のために設定している情報）
// - 再生中か・再生位置・長さ: ページ内の <video> 要素
// - 動画 ID: URL の ?v=
//
// 読み取った情報は拡張の service worker 経由で Nowstr のタブにだけ渡し、どこにも保存しない。

(() => {
  const HEARTBEAT_MS = 15_000;
  const POLL_MS = 1_000;

  /** @type {chrome.runtime.Port | null} */
  let port = null;
  let lastKey = "";
  let lastSentAt = 0;
  /** @type {BridgePlaybackState | null} */
  let lastState = null;

  const connect = () => {
    // 拡張が更新・削除されたあとは何もしない
    if (!chrome.runtime?.id) return;
    port = chrome.runtime.connect({ name: "ytm" });
    port.onDisconnect.addListener(() => {
      port = null;
      setTimeout(connect, 1_000);
    });
    lastKey = "";
    report();
  };

  const videoId = () => new URLSearchParams(location.search).get("v");

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
    const id = videoId();
    // 広告の再生中は曲として扱わない
    const isAd = document.querySelector(".ad-showing") !== null;
    if (!video || !metadata || !metadata.title || !id || isAd) return null;
    const durationMs = Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : 0;
    if (durationMs <= 0) return null;
    return {
      track: {
        uri: `https://music.youtube.com/watch?v=${encodeURIComponent(id)}`,
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
    if (!port) return;
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

  // media 要素のイベントはバブリングしないので capture で拾う
  for (const type of ["play", "pause", "ended", "seeked", "loadedmetadata", "durationchange"]) {
    document.addEventListener(type, () => setTimeout(report, 50), true);
  }
  setInterval(report, POLL_MS);
  connect();
})();
