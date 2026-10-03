import { createStore } from "solid-js/store";
import { loadJson, saveJson } from "../lib/storage";

export const DEFAULT_FALLBACK_RELAYS = ["wss://relay.damus.io", "wss://nos.lol", "wss://yabu.me"];

/** kind:10002 を探しに行く relay（fallback relay に加えて使う、relay list が集まりやすい relay） */
export const RELAY_LIST_INDEXERS = ["wss://purplepag.es", "wss://directory.yabu.me"];

export type Settings = {
  /** 再生中の曲をどこから取るか（未選択なら利用できる最初のもの） */
  source?: "spotify" | "youtube-music";
  /** music status を投稿するか */
  statusEnabled: boolean;
  /** タブを閉じたときに status を消す（曲ごとに消去用イベントへの署名が1回増える） */
  clearOnClose: boolean;
  /** 再生中にタブを閉じようとしたら、ブラウザの「このサイトを離れますか？」を表示する */
  confirmBeforeClose: boolean;
  /** NIP-65 relay list が見つからないときに使う relay */
  fallbackRelays: string[];
  /** 前回 Nostr にログインしていたら起動時に再接続する */
  nostrAutoConnect: boolean;
};

const KEY = "nowstr:settings";

const defaults: Settings = {
  statusEnabled: true,
  clearOnClose: true,
  confirmBeforeClose: true,
  fallbackRelays: DEFAULT_FALLBACK_RELAYS,
  nostrAutoConnect: false,
};

const [settings, setStore] = createStore<Settings>({
  ...defaults,
  ...loadJson<Partial<Settings>>(KEY),
});

export { settings };

export const updateSettings = (patch: Partial<Settings>): void => {
  setStore(patch);
  saveJson(KEY, { ...settings });
};
