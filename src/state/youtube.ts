import { createSignal } from "solid-js";
import type { PlaybackState } from "../core/playback";
import { parseExtensionMessage, pingMessage } from "../youtube/extension-protocol";

/**
 * YouTube Music 側の状態。再生状態はブラウザ拡張（Nowstr Bridge）が
 * YouTube Music のタブから読み取り、window.postMessage で届けてくれる。
 */

/** 拡張がこのページに入っているか。判定中は null */
const [extensionDetected, setExtensionDetected] = createSignal<boolean | null>(null);
/** YouTube Music のタブで再生中の曲。YouTube Music を開いていなければ null */
const [youtubePlayback, setYoutubePlayback] = createSignal<PlaybackState | null>(null);

export { extensionDetected, youtubePlayback };

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
    if (message.type === "playback") setYoutubePlayback(message.state);
  });
  window.postMessage(pingMessage, location.origin);
  setTimeout(() => {
    if (extensionDetected() === null) setExtensionDetected(false);
  }, DETECT_TIMEOUT_MS);
};
