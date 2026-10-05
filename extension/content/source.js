// Nowstr: 音楽サービスのタブで動く content script の共通部分。
//
// サービスごとのファイル（sources/*.js）は defineMusicSource() に MusicSourceAdapter を渡すだけにする。
// どのサービスでも使える情報はここで読み、adapter はそれで足りない部分（曲の URL・広告の判定など）だけを補う。
//
// - 曲名・アーティスト・アルバム・アートワーク: navigator.mediaSession.metadata
//   （各サービスが OS のメディア操作のために設定している情報）
// - 再生中か・再生位置・長さ: 再生中の media 要素（main-world.js が <html data-nowstr-media> に書く）。
//   なければ navigator.mediaSession.playbackState
//
// ポーリングはせず、main-world.js の "nowstr:media" イベント（再生状態や曲が変わった）のあとにだけ読む。
// 曲の URL などサービスの画面から読むものは少し遅れて変わるので、イベントのあと何回か読み直す。
//
// 読み取った状態は、変わったときだけ service worker（"player" ポート）に送り、どこにも保存しない。
// service worker は何もなければ止まってよいので、ポートが切れてもすぐにはつなぎ直さず、次に送るときにつなぐ。
// service worker から頼まれたときだけ、NIP-07 の署名を main-world.js に中継する。

/**
 * 音楽サービスのタブで、再生状態の読み取りと service worker との通信を始める。
 * 同じ content_scripts のエントリに入れたファイル間ではグローバルを共有するので、sources/*.js から呼べる。
 * @param {MusicSourceAdapter} adapter
 */
// oxlint-disable-next-line no-unused-vars -- sources/*.js から呼ぶ
function defineMusicSource(adapter) {
  /** イベントのあとに読み直す時刻（ミリ秒）。サービスの画面の更新を待つ */
  const REREAD_MS = [50, 500, 2_000];

  // 拡張の更新などで二重に動かないよう、先に動いていたものを止める
  window.__nowstrSourceStop?.();
  let stopped = false;

  /** @type {chrome.runtime.Port | null} */
  let port = null;
  let lastKey = "";
  /** @type {BridgePlaybackState | null} */
  let lastState = null;

  /** service worker につなぐ（止まっていれば起こされる）。つないだら、いまの状態を改めて送る */
  const connect = () => {
    const next = chrome.runtime.connect({ name: "player" });
    next.onMessage.addListener(onPortMessage);
    next.onDisconnect.addListener(() => {
      if (port === next) port = null;
    });
    port = next;
    lastKey = "";
    return next;
  };

  /** @returns {MediaSnapshot | null} */
  const readMedia = () => {
    const raw = document.documentElement.dataset.nowstrMedia;
    if (!raw) return null;
    try {
      const media = JSON.parse(raw);
      // 書かれてから経った時間ぶん進める
      const elapsed = media.paused ? 0 : Math.max(0, Date.now() - media.at);
      return {
        paused: Boolean(media.paused),
        positionMs: Math.min(media.positionMs + elapsed, media.durationMs),
        durationMs: media.durationMs,
      };
    } catch {
      return null;
    }
  };

  /** @returns {BridgePlaybackState | null} */
  const readState = () => {
    const metadata = navigator.mediaSession?.metadata ?? null;
    const media = readMedia();
    const playbackState = navigator.mediaSession?.playbackState ?? "none";
    const reading = adapter.read({ metadata, media, playbackState });
    if (!reading) return null;
    const title = reading.title ?? metadata?.title;
    const durationMs = reading.durationMs ?? media?.durationMs ?? 0;
    if (!title || !reading.uri || !(durationMs > 0)) return null;
    const artist = metadata?.artist;
    return {
      track: {
        source: adapter.source,
        uri: reading.uri,
        title,
        artists: reading.artists ?? (artist ? [artist] : []),
        album: reading.album ?? metadata?.album ?? "",
        artworkUrl:
          reading.artworkUrl !== undefined ? reading.artworkUrl : largestArtwork(metadata?.artwork),
        durationMs,
        unlisted: reading.unlisted ?? false,
      },
      paused: reading.paused ?? media?.paused ?? playbackState !== "playing",
      positionMs: Math.round(reading.positionMs ?? media?.positionMs ?? 0),
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
    // 拡張が更新・削除されたあとは何もしない
    if (!chrome.runtime?.id) stop();
    if (stopped) return;
    /** @type {BridgePlaybackState | null} */
    let state;
    try {
      state = readState();
    } catch (error) {
      // サービス側の画面構成が変わっても、タブの動作には影響させない
      console.debug("[Nowstr] failed to read the playback state", error);
      state = null;
    }
    const track = state?.track;
    const key =
      state && track
        ? [
            track.uri,
            track.title,
            track.artists.join(","),
            track.unlisted,
            state.paused,
            state.durationMs,
          ].join("|")
        : "none";
    if (port && key === lastKey && !seeked(lastState, state)) {
      lastState = state;
      return;
    }
    try {
      (port ?? connect()).postMessage({ type: "playback", state });
      lastKey = key;
      lastState = state;
    } catch {
      port = null;
    }
  };

  /** @type {Map<string, (response: { result?: unknown, error?: string }) => void>} */
  const pendingNip07 = new Map();

  /** @param {Event} event */
  const onNip07Response = (event) => {
    try {
      const { id, ...response } = JSON.parse(String(/** @type {CustomEvent} */ (event).detail));
      pendingNip07.get(id)?.(response);
      pendingNip07.delete(id);
    } catch {
      // 形式が違うものは無視する
    }
  };
  document.addEventListener("nowstr:nip07-response", onNip07Response);

  /** @param {BridgeWorkerMessage} message */
  function onPortMessage(message) {
    if (message?.type !== "nip07") return;
    const { id, method, params } = message;
    pendingNip07.set(id, (response) => {
      try {
        port?.postMessage({ type: "nip07-result", id, ...response });
      } catch {
        // 切断済みなら service worker 側がタイムアウトする
      }
    });
    document.dispatchEvent(
      new CustomEvent("nowstr:nip07-request", { detail: JSON.stringify({ id, method, params }) }),
    );
  }

  /** @type {ReturnType<typeof setTimeout>[]} */
  let timers = [];
  const onMediaEvent = () => {
    for (const timer of timers) clearTimeout(timer);
    timers = REREAD_MS.map((ms) => setTimeout(report, ms));
  };
  document.addEventListener("nowstr:media", onMediaEvent);

  /**
   * service worker が作り直されたとき、開いているタブに状態を聞き直す（"report"）。
   * 止まっている間に別のタブで再生が止まった、などを取りこぼさないため。
   * @param {unknown} message
   * @param {chrome.runtime.MessageSender} _sender
   * @param {(response: boolean) => void} sendResponse
   */
  const onRuntimeMessage = (message, _sender, sendResponse) => {
    if (/** @type {{ type?: unknown }} */ (message)?.type !== "report") return;
    lastKey = "";
    report();
    sendResponse(true);
  };
  chrome.runtime.onMessage.addListener(onRuntimeMessage);

  function stop() {
    stopped = true;
    for (const timer of timers) clearTimeout(timer);
    document.removeEventListener("nowstr:media", onMediaEvent);
    try {
      chrome.runtime.onMessage.removeListener(onRuntimeMessage);
    } catch {
      // 拡張が更新済みで外せないことがある
    }
    document.removeEventListener("nowstr:nip07-response", onNip07Response);
    try {
      port?.disconnect();
    } catch {
      // 拡張が更新済みで切断できないことがある
    }
    port = null;
  }
  window.__nowstrSourceStop = stop;

  report();
}

/**
 * mediaSession のアートワークのうち、いちばん大きいもの（https のみ）
 * @param {readonly MediaImage[] | undefined} artwork
 */
function largestArtwork(artwork) {
  /** @type {{ src: string, size: number } | null} */
  let best = null;
  for (const image of artwork ?? []) {
    const size = Number.parseInt(String(image.sizes ?? "0").split("x")[0] ?? "", 10) || 0;
    if (!best || size > best.size) best = { src: image.src, size };
  }
  return best?.src?.startsWith("https://") ? best.src : null;
}

/**
 * 相対 URL も含めて URL として読む。読めなければ null
 * @param {string | null | undefined} href
 */
// oxlint-disable-next-line no-unused-vars -- sources/*.js から呼ぶ
function parseHref(href) {
  if (!href) return null;
  try {
    return new URL(href, location.href);
  } catch {
    return null;
  }
}
