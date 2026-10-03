// Nowstr Bridge: Nowstr のページに入る content script。
// service worker から届いた再生状態を window.postMessage でページへ渡す。
// メッセージ形式は src/youtube/extension-protocol.ts と揃えること。

(() => {
  const TAG = "__nowstr";
  const version = chrome.runtime.getManifest().version;

  // 動作確認中のため、Nowstr のタブの DevTools コンソールに "[Nowstr Bridge:page]" でログを出す
  /** @param {unknown[]} args */
  const log = (...args) => console.info("[Nowstr Bridge:page]", ...args);

  // 拡張の更新などで二重に動かないよう、先に動いていたものを止める
  window.__nowstrBridgeStop?.();
  let stopped = false;
  /** @type {chrome.runtime.Port | null} */
  let port = null;

  /** @param {{ type: string } & Record<string, unknown>} message */
  const post = (message) => window.postMessage({ [TAG]: "extension", ...message }, location.origin);

  const connect = () => {
    if (stopped || !chrome.runtime?.id) return;
    port = chrome.runtime.connect({ name: "nowstr" });
    log("service worker に接続しました");
    port.onMessage.addListener((/** @type {BridgePlaybackMessage} */ message) => {
      if (message?.type !== "playback") return;
      const track = message.state?.track;
      log("ページへ渡す:", track ? `${track.title} ${message.state?.paused ? "⏸" : "▶"}` : "null");
      post({ type: "playback", state: message.state });
    });
    port.onDisconnect.addListener(() => {
      log("service worker から切断されました。1秒後に再接続します", chrome.runtime.lastError ?? "");
      port = null;
      setTimeout(connect, 1_000);
    });
  };

  // ページ側の準備ができたタイミング（ping）でも、拡張が入っていることを知らせる
  /** @param {MessageEvent} event */
  const onMessage = (event) => {
    if (event.source !== window || event.data?.[TAG] !== "page") return;
    if (event.data.type === "ping") {
      log("ページから ping を受信");
      post({ type: "hello", version });
    }
  };
  window.addEventListener("message", onMessage);

  window.__nowstrBridgeStop = () => {
    stopped = true;
    window.removeEventListener("message", onMessage);
    try {
      port?.disconnect();
    } catch {
      // 拡張が更新済みで切断できないことがある
    }
    port = null;
  };

  log(`起動しました (v${version})`);
  post({ type: "hello", version });
  connect();
})();
