import { createSignal } from "solid-js";
import type { PlaybackState } from "../core/playback";
import { isOlderVersion } from "../core/version";
import { parseExtensionMessage, pingMessage } from "../youtube/extension-protocol";

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

/** 配布している最新の拡張のバージョン */
export const LATEST_EXTENSION_VERSION = __LATEST_EXTENSION_VERSION__;

/** 入っている拡張が最新版より古いか。古くても動くので、更新を案内するだけにする */
export const extensionOutdated = (): boolean => {
  const version = extensionVersion();
  return version !== null && isOlderVersion(version, LATEST_EXTENSION_VERSION);
};

/** 拡張の content script より先にページが動き出すことがあるので、しばらく待ってから「なし」と判定する */
const DETECT_TIMEOUT_MS = 2_000;

let started = false;

export const initYouTubeMusic = (): void => {
  if (started) return;
  started = true;
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const message = parseExtensionMessage(event.data);
    if (!message) return;
    setExtensionDetected(true);
    setLastMessageAt(Date.now());
    if (message.type === "hello") {
      setExtensionVersion(message.version);
    } else {
      setYoutubePlayback(message.state);
    }
  });
  window.postMessage(pingMessage, location.origin);
  setTimeout(() => {
    if (extensionDetected() === null) setExtensionDetected(false);
  }, DETECT_TIMEOUT_MS);
};
