// Nowstr Bridge: YouTube Music のタブ（"ytm" ポート）から届いた再生状態を、
// Nowstr のタブ（"nowstr" ポート）へ中継する service worker。
// 状態は保存せず、メモリ上で最新のものだけを持つ。

/** @type {Map<number, { state: BridgePlaybackState | null, at: number }>} YouTube Music のタブごとの最新状態 */
const players = new Map();
/** @type {Set<chrome.runtime.Port>} */
const pages = new Set();

/** 再生中のタブを優先し、なければ最後に更新されたタブの状態を返す */
const currentState = () => {
  /** @type {{ state: BridgePlaybackState | null, at: number } | null} */
  let best = null;
  for (const entry of players.values()) {
    const playing = entry.state && !entry.state.paused;
    const bestPlaying = best && best.state && !best.state.paused;
    if (!best || (playing && !bestPlaying) || (playing === bestPlaying && entry.at > best.at)) {
      best = entry;
    }
  }
  return best ? best.state : null;
};

const broadcast = () => {
  const message = { type: "playback", state: currentState() };
  for (const port of pages) {
    try {
      port.postMessage(message);
    } catch {
      // 切断済みのポート（タブを閉じた直後など）は無視する
    }
  }
};

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "ytm") {
    const tabId = port.sender?.tab?.id;
    if (tabId === undefined) return;
    players.set(tabId, { state: null, at: Date.now() });
    port.onMessage.addListener((/** @type {BridgePlaybackMessage} */ message) => {
      if (message?.type !== "playback") return;
      players.set(tabId, { state: message.state, at: Date.now() });
      broadcast();
    });
    port.onDisconnect.addListener(() => {
      players.delete(tabId);
      broadcast();
    });
  } else if (port.name === "nowstr") {
    pages.add(port);
    port.postMessage({ type: "playback", state: currentState() });
    port.onDisconnect.addListener(() => {
      pages.delete(port);
    });
  }
});

// 拡張をインストール・更新した時点ですでに開いているタブには、manifest の content script が入らない
// （タブを再読み込みするまで動かない）。そのため、該当するタブには自分で注入する。
const injectIntoOpenTabs = async () => {
  for (const script of chrome.runtime.getManifest().content_scripts ?? []) {
    if (!script.matches || !script.js) continue;
    const tabs = await chrome.tabs.query({ url: script.matches });
    for (const tab of tabs) {
      if (tab.id === undefined || tab.discarded) continue;
      const tabId = tab.id;
      chrome.scripting
        .executeScript({
          target: { tabId },
          files: script.js,
          // MAIN world の補助スクリプト（youtube-music-main.js）はページ側で動かす
          // @types/chrome の manifest 型に world がないため、ここだけ型を広げて読む
          world: /** @type {{ world?: string }} */ (script).world === "MAIN" ? "MAIN" : "ISOLATED",
        })
        .catch(() => {
          // 読み込み中のタブなどには注入できないことがある（その場合は再読み込みで動く）
        });
    }
  }
};

chrome.runtime.onInstalled.addListener(() => {
  void injectIntoOpenTabs();
});
