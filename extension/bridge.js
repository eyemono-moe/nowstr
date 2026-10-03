// Nowstr Bridge: Nowstr のページに入る content script。
// service worker から届いた再生状態を window.postMessage でページへ渡す。
// メッセージ形式は src/youtube/extension-protocol.ts と揃えること。

(() => {
  const TAG = "__nowstr";
  const version = chrome.runtime.getManifest().version;

  /** @param {{ type: string } & Record<string, unknown>} message */
  const post = (message) => window.postMessage({ [TAG]: "extension", ...message }, location.origin);

  const connect = () => {
    if (!chrome.runtime?.id) return;
    const port = chrome.runtime.connect({ name: "nowstr" });
    port.onMessage.addListener((/** @type {BridgePlaybackMessage} */ message) => {
      if (message?.type === "playback") post({ type: "playback", state: message.state });
    });
    port.onDisconnect.addListener(() => setTimeout(connect, 1_000));
  };

  // ページ側の準備ができたタイミング（ping）でも、拡張が入っていることを知らせる
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.[TAG] !== "page") return;
    if (event.data.type === "ping") post({ type: "hello", version });
  });

  post({ type: "hello", version });
  connect();
})();
