// Nowstr Bridge: YouTube Music のタブ（"ytm" ポート）から届いた再生状態を、
// Nowstr のタブ（"nowstr" ポート）へ中継する service worker。
// 状態は保存せず、メモリ上で最新のものだけを持つ。
// 動作確認中のため、service worker のコンソール（chrome://extensions → Nowstr Bridge → 「service worker」）にログを出す。

/** @param {unknown[]} args */
const log = (...args) => console.info("[Nowstr Bridge:bg]", ...args);

/** @param {BridgePlaybackState | null} state */
const describe = (state) =>
  state?.track ? `${state.track.title} ${state.paused ? "⏸" : "▶"}` : "null";

log(`起動しました (v${chrome.runtime.getManifest().version})`);

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
  log(`Nowstr のタブ ${pages.size} 件へ中継:`, describe(message.state));
  for (const port of pages) {
    try {
      port.postMessage(message);
    } catch (error) {
      log("中継に失敗しました", error);
    }
  }
};

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "ytm") {
    const tabId = port.sender?.tab?.id;
    if (tabId === undefined) return;
    log(`YouTube Music のタブ ${tabId} が接続しました`);
    players.set(tabId, { state: null, at: Date.now() });
    port.onMessage.addListener((/** @type {BridgePlaybackMessage} */ message) => {
      if (message?.type !== "playback") return;
      log(`タブ ${tabId} から受信:`, describe(message.state));
      players.set(tabId, { state: message.state, at: Date.now() });
      broadcast();
    });
    port.onDisconnect.addListener(() => {
      log(`YouTube Music のタブ ${tabId} が切断しました`);
      players.delete(tabId);
      broadcast();
    });
  } else if (port.name === "nowstr") {
    pages.add(port);
    log(`Nowstr のタブ ${port.sender?.tab?.id} が接続しました（${port.sender?.url}）`);
    port.postMessage({ type: "playback", state: currentState() });
    port.onDisconnect.addListener(() => {
      log(`Nowstr のタブ ${port.sender?.tab?.id} が切断しました`);
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
        .then(() => log(`開いていたタブ ${tabId} に ${script.js?.join(", ")} を注入しました`))
        .catch((error) => {
          // 読み込み中のタブなどには注入できないことがある（その場合は再読み込みで動く）
          log(`タブ ${tabId} への注入に失敗しました`, error);
        });
    }
  }
};

chrome.runtime.onInstalled.addListener((details) => {
  log(`onInstalled (${details.reason})`);
  void injectIntoOpenTabs();
});
