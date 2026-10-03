import { createSignal } from "solid-js";
import type { PlaybackState } from "../core/playback";
import { debugLog, describePlayback } from "../lib/debug";
import {
  EXTENSION_MESSAGE_TAG,
  parseExtensionMessage,
  pingMessage,
} from "../youtube/extension-protocol";

/**
 * YouTube Music 側の状態。再生状態はブラウザ拡張（Nowstr Bridge）が
 * YouTube Music のタブから読み取り、window.postMessage で届けてくれる。
 */

/** 拡張がこのページに入っているか。判定中は null */
const [extensionDetected, setExtensionDetected] = createSignal<boolean | null>(null);
/** YouTube Music のタブで再生中の曲。YouTube Music を開いていなければ null */
const [youtubePlayback, setYoutubePlayback] = createSignal<PlaybackState | null>(null);

/** 診断用: 拡張のバージョンと最後に受け取った時刻 */
const [extensionVersion, setExtensionVersion] = createSignal<string | null>(null);
const [lastMessageAt, setLastMessageAt] = createSignal<number | null>(null);

export { extensionDetected, extensionVersion, lastMessageAt, youtubePlayback };

/** 拡張の content script より先にページが動き出すことがあるので、しばらく待ってから「なし」と判定する */
const DETECT_TIMEOUT_MS = 2_000;

let started = false;

export const initYouTubeMusic = (): void => {
  if (started) return;
  started = true;
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const message = parseExtensionMessage(event.data);
    if (!message) {
      // Nowstr 宛てなのに読めないメッセージ（形式の不一致）は調査のために記録する
      const data: unknown = event.data;
      if (
        typeof data === "object" &&
        data !== null &&
        (data as Record<string, unknown>)[EXTENSION_MESSAGE_TAG] === "extension"
      ) {
        debugLog("youtube", "拡張からのメッセージを読めませんでした", data);
      }
      return;
    }
    setExtensionDetected(true);
    setLastMessageAt(Date.now());
    if (message.type === "hello") {
      setExtensionVersion(message.version);
      debugLog("youtube", `拡張 Nowstr Bridge v${message.version} を検出`);
    } else {
      debugLog("youtube", "再生状態を受信:", describePlayback(message.state));
      setYoutubePlayback(message.state);
    }
  });
  debugLog("youtube", "拡張の検出を開始（ping）");
  window.postMessage(pingMessage, location.origin);
  setTimeout(() => {
    if (extensionDetected() === null) {
      setExtensionDetected(false);
      debugLog("youtube", `${DETECT_TIMEOUT_MS}ms 以内に拡張から応答がありませんでした`);
    }
  }, DETECT_TIMEOUT_MS);
};
