import { createStore } from "solid-js/store";
import type { EventTemplate } from "../core/nip38";
import { normalizeRelayUrl } from "../core/relay-list";
import { AppError } from "../lib/errors";
import { NostrRelayClient } from "../nostr/publisher";
import { createNip07Signer, hasNip07, type NostrSigner, waitForNip07 } from "../nostr/signer";
import { MusicStatusController, type StatusSnapshot } from "../status/music-status-controller";
import { RELAY_LIST_INDEXERS, settings, updateSettings } from "./settings";
import { notifyError } from "./toast";

/**
 * Nostr 側の状態。Spotify の再生には一切影響を与えない。
 * 送信の失敗は toast と status 表示に留める。
 */

type NostrStore = {
  /**
   * NIP-07 拡張の有無。判定中は null。
   * false でも後から注入される可能性があるため、確定ではなく「現時点で見つからない」の意味。
   */
  nip07Available: boolean | null;
  pubkey: string | null;
  connecting: boolean;
  relays: string[];
  relaySource: "nip65" | "fallback" | null;
  status: StatusSnapshot;
};

const [store, setStore] = createStore<NostrStore>({
  nip07Available: null,
  pubkey: null,
  connecting: false,
  relays: [],
  relaySource: null,
  status: { phase: "idle", status: null, error: null },
});

export { store as nostr };

let signer: NostrSigner | null = null;
let client: NostrRelayClient | null = null;

const fallbackRelays = (): string[] =>
  settings.fallbackRelays.flatMap((url) => normalizeRelayUrl(url) ?? []);

const signAndPublish = async (template: EventTemplate): Promise<void> => {
  if (!signer || !client) throw new AppError("nip07_unavailable", "Nostr にログインしていません。");
  const event = await signer.signEvent(template);
  const result = await client.publish(event, store.relays);
  if (result.accepted.length > 0) {
    if (result.rejected.length + result.unreachable.length > 0) {
      console.warn("Some relays did not accept the music status", result);
    }
    return;
  }
  if (result.rejected.length === 0) {
    throw new AppError(
      "relay_connection_failed",
      `relay に接続できませんでした (${result.unreachable.join(", ")})。`,
    );
  }
  throw new AppError(
    "relay_publish_failed",
    `music status の投稿が relay に拒否されました: ${result.rejected
      .map(({ relay, reason }) => `${relay} (${reason})`)
      .join(", ")}`,
  );
};

export const statusController = new MusicStatusController({
  send: signAndPublish,
  onChange: (snapshot) => {
    setStore("status", snapshot);
    if (snapshot.phase === "error") notifyError(snapshot.error, "Nostr status");
  },
});

const resolveRelays = async (pubkey: string) => {
  const fallback = fallbackRelays();
  const lookup = [...new Set([...fallback, ...RELAY_LIST_INDEXERS])];
  const writeRelays = await client!.fetchWriteRelays(pubkey, lookup);
  if (writeRelays) setStore({ relays: writeRelays, relaySource: "nip65" });
  else setStore({ relays: fallback, relaySource: "fallback" });
};

/** 起動時に「見つからない」と表示するまでの待ち時間 */
const INITIAL_DETECT_MS = 2_000;
/** その後もバックグラウンドで注入を待ち続ける時間 */
const BACKGROUND_DETECT_MS = 30_000;
/** ログインボタンを押したときに待つ時間 */
const LOGIN_DETECT_MS = 3_000;

/** 起動後に遅れて注入された / ウィンドウ復帰時に見つかった拡張を拾う */
const watchNip07 = () => {
  const found = () => {
    setStore({ nip07Available: true });
    window.removeEventListener("focus", onFocus);
    if (settings.nostrAutoConnect && !store.pubkey && !store.connecting) void loginNostr();
  };
  const onFocus = () => hasNip07() && found();
  window.addEventListener("focus", onFocus);
  void waitForNip07(BACKGROUND_DETECT_MS).then((ok) => ok && !store.nip07Available && found());
};

export const initNostr = async (): Promise<void> => {
  const available = await waitForNip07(INITIAL_DETECT_MS);
  setStore({ nip07Available: available });
  if (!available) {
    watchNip07();
    return;
  }
  if (settings.nostrAutoConnect) await loginNostr();
};

export const loginNostr = async (): Promise<void> => {
  setStore({ connecting: true });
  if (!(await waitForNip07(LOGIN_DETECT_MS))) {
    setStore({ connecting: false, nip07Available: false });
    notifyError(
      new AppError(
        "nip07_unavailable",
        "NIP-07 対応のブラウザ拡張（nos2x, Alby など）が見つかりません。拡張を有効にしてからページを再読み込みしてください。",
      ),
      "Nostr",
    );
    return;
  }
  setStore({ nip07Available: true });
  try {
    signer = createNip07Signer();
    const pubkey = await signer.getPublicKey();
    client = new NostrRelayClient();
    setStore({ pubkey });
    updateSettings({ nostrAutoConnect: true });
    await resolveRelays(pubkey);
  } catch (error) {
    signer = null;
    client?.dispose();
    client = null;
    setStore({ pubkey: null });
    notifyError(error, "Nostr");
  } finally {
    setStore({ connecting: false });
  }
};

export const logoutNostr = async (): Promise<void> => {
  // 掲示中の status は可能なら消してから切断する（失敗しても expiration で消える）
  await statusController.clearNow().catch(() => {});
  signer = null;
  client?.dispose();
  client = null;
  updateSettings({ nostrAutoConnect: false });
  setStore({
    pubkey: null,
    relays: [],
    relaySource: null,
    status: { phase: "idle", status: null, error: null },
  });
};

/** fallback relay の設定変更を反映する */
export const refreshRelays = async (): Promise<void> => {
  if (store.pubkey && client) await resolveRelays(store.pubkey);
};

export const canPublishStatus = (): boolean =>
  store.pubkey !== null && store.relays.length > 0 && !store.connecting;
