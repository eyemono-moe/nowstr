// Nowstr の service worker。
//
// - 音楽サービスのタブ（"player" ポート）から届いた再生状態をまとめる
// - 投稿がオンなら、ExtensionPublisher が music status を投稿する
// - ポップアップ（"popup" ポート）に状態を見せ、設定を受け取る
//
// ポーリングはしない。タブの content script は再生状態が変わったときだけ送ってくるので、
// 長い曲を聴いている間など、何も起きなければ service worker は止められてよい。
// 止まっている間の出来事は次のように拾う。
// - 再生状態が変わった: content script がつなぎ直して送ってくる（それで起こされる）
// - タブを閉じた・別のページへ移動した: tabs.onRemoved / tabs.onUpdated で起こされる
// 起こされたら、開いている音楽サービスのタブに状態を聞き直してから判断する（discoverPlayers）。
// 投稿の続きに必要なもの（掲示中の status など）は ExtensionPublisher が chrome.storage.local に保存する。
//
// サイトへのアクセス権限はサービスごとにポップアップで求める（services.ts）。
// 許可されたサービスにだけ content script を登録し、許可を外されたら登録を消して、そのタブのスクリプトも止める。

import type { PlaybackState } from "./core/playback";
import { parsePublisherConfig, type PublisherInfo } from "./protocol";
import { ExtensionPublisher } from "./publisher";
import {
  contentScriptsFor,
  grantedServices,
  SERVICES,
  type ServiceDefinition,
  serviceForUrl,
} from "./services";
import { TabSigner } from "./tab-signer";

type Player = {
  service: ServiceDefinition["id"];
  port: chrome.runtime.Port;
  signer: TabSigner;
  state: PlaybackState | null;
  at: number;
};

/** タブごとの最新状態 */
const players = new Map<number, Player>();
const popups = new Set<chrome.runtime.Port>();

/** 再生中のタブを優先し、なければ最後に更新されたタブ */
const currentPlayer = (): Player | null => {
  let best: Player | null = null;
  for (const player of players.values()) {
    const playing = player.state !== null && !player.state.paused;
    const bestPlaying = best?.state != null && !best.state.paused;
    if (!best || (playing && !bestPlaying) || (playing === bestPlaying && player.at > best.at)) {
      best = player;
    }
  }
  return best;
};

const currentState = (): PlaybackState | null => currentPlayer()?.state ?? null;

const postToPopups = (message: unknown) => {
  for (const port of popups) {
    try {
      port.postMessage(message);
    } catch {
      // 閉じたポップアップのポートは無視する
    }
  }
};

/** 拡張のアイコンに、投稿の状態を小さく出す（オフなら何も出さない） */
const updateBadge = (info: PublisherInfo) => {
  const error = info.config.enabled && info.phase === "error";
  void chrome.action.setBadgeText({ text: !info.config.enabled ? "" : error ? "!" : "ON" });
  void chrome.action.setBadgeBackgroundColor({ color: error ? "#f87171" : "#a78bfa" });
};

const publisherReady = ExtensionPublisher.load({
  // 曲を再生しているタブで署名する（そのタブの NIP-07 拡張の確認が出る）。なければ他の音楽サービスのタブ
  signer: () => currentPlayer()?.signer ?? null,
  onInfo: (info: PublisherInfo) => {
    postToPopups({ type: "publisher", info });
    updateBadge(info);
  },
});

const DISCOVERY_TIMEOUT_MS = 3_000;

/**
 * 開いている音楽サービスのタブに状態を聞き直す。各タブの content script はつないできて、いまの状態を送ってくる。
 * service worker が作り直された直後は、どのタブで何を再生しているか分からないため。
 */
const discoverPlayers = async (): Promise<void> => {
  const urls = (await grantedServices()).flatMap((service) => service.matches);
  if (urls.length === 0) return;
  const tabs = await chrome.tabs.query({ url: urls }).catch(() => []);
  const asks = tabs.flatMap((tab) =>
    tab.id === undefined || tab.discarded
      ? []
      : [chrome.tabs.sendMessage(tab.id, { type: "report" }).catch(() => {})],
  );
  await Promise.race([
    Promise.allSettled(asks),
    new Promise((resolve) => setTimeout(resolve, DISCOVERY_TIMEOUT_MS)),
  ]);
};

/** 起動直後は、タブに聞き直し終わるまで「再生していない」とは判断しない */
const ready = Promise.all([publisherReady, discoverPlayers()]).then(([publisher]) => publisher);

const sync = async () => {
  (await ready).update(currentState());
};

const onStateChange = () => {
  postToPopups({ type: "playback", state: currentState() });
  void sync();
};

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "player") {
    const tabId = port.sender?.tab?.id;
    const service = serviceForUrl(port.sender?.url);
    if (tabId === undefined || !service) {
      port.disconnect();
      return;
    }
    // 同じタブで古いポートがつながっていたら置き換える
    players.get(tabId)?.signer.dispose();
    const player: Player = {
      service: service.id,
      port,
      signer: new TabSigner(port),
      state: null,
      at: Date.now(),
    };
    players.set(tabId, player);
    // 許可を外したあとも、外す前から開いていたタブのスクリプトはつないでくることがあるので確かめる
    void grantedServices().then((granted) => {
      if (!granted.some((item) => item.id === service.id)) stopPlayers([service.id]);
    });
    port.onMessage.addListener((message: BridgePlayerMessage) => {
      if (message?.type === "playback") {
        player.state = message.state;
        player.at = Date.now();
        onStateChange();
      } else if (message?.type === "nip07-result" && typeof message.id === "string") {
        player.signer.handleResult(message);
      }
    });
    port.onDisconnect.addListener(() => {
      player.signer.dispose();
      if (players.get(tabId) !== player) return;
      players.delete(tabId);
      // タブを閉じた・別のページへ移動した。再生していた曲の status は、用意してある消去イベントで消す
      onStateChange();
    });
  } else if (port.name === "popup") {
    popups.add(port);
    port.postMessage({ type: "playback", state: currentState() });
    void publisherReady.then((publisher) => {
      port.postMessage({ type: "publisher", info: publisher.info() });
    });
    // 起こされた直後なら、聞き直し終わったところで改めて送る
    void ready.then(() => port.postMessage({ type: "playback", state: currentState() }));
    port.onMessage.addListener((message: { type?: unknown; config?: unknown }) => {
      if (message?.type !== "configure") return;
      const config = parsePublisherConfig(message.config);
      if (!config) return;
      void ready.then((publisher) => publisher.configure(config, currentState()));
    });
    port.onDisconnect.addListener(() => {
      popups.delete(port);
    });
  }
});

// 止まっている間にタブが閉じられた・移動した場合も起こしてもらい、掲示中の status を消せるようにする。
// 起きたときの処理（タブへの聞き直し → sync）は上の ready が行うので、ここでは何もしなくてよいが、
// すでに起きていた場合に備えて、知っているタブなら状態を見直す。
chrome.tabs.onRemoved.addListener((tabId) => {
  if (players.has(tabId)) onStateChange();
});
// 権限のないサイトへ移動したときは url が届かないので、読み込みの開始（status）で見る
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading" && players.has(tabId)) void sync();
});

// ブラウザの起動時にも service worker を起こす。前回ブラウザを閉じたときに消せなかった status を、
// 用意してある消去イベントで消すため（再生中のタブがなければ、聞き直したあとに消える）
chrome.runtime.onStartup.addListener(() => {});
void publisherReady.then((publisher) => updateBadge(publisher.info()));
void sync();

/** 許可を外されたサービスのタブのスクリプトを止め、そのタブの再生状態を忘れる（掲示中の status は消える） */
const stopPlayers = (ids: ServiceDefinition["id"][]) => {
  let changed = false;
  for (const [tabId, player] of players) {
    if (!ids.includes(player.service)) continue;
    try {
      player.port.postMessage({ type: "stop" });
      player.port.disconnect();
    } catch {
      // 切断済み
    }
    player.signer.dispose();
    players.delete(tabId);
    changed = true;
  }
  if (changed) onStateChange();
};

/**
 * 許可されているサービスに content script を登録し直す。
 * 拡張の更新でスクリプトの構成が変わることがあるので、いったんすべて外してから登録する。
 */
const registerContentScripts = async (): Promise<ServiceDefinition[]> => {
  const ours = new Set(
    SERVICES.flatMap((service) => contentScriptsFor(service).map((script) => script.id)),
  );
  const registered = await chrome.scripting.getRegisteredContentScripts();
  const stale = registered.filter((script) => ours.has(script.id)).map((script) => script.id);
  if (stale.length > 0) await chrome.scripting.unregisterContentScripts({ ids: stale });
  const granted = await grantedServices();
  if (granted.length > 0) {
    await chrome.scripting.registerContentScripts(granted.flatMap(contentScriptsFor));
  }
  return granted;
};

/**
 * すでに開いているタブには、登録した content script が入らない（タブを再読み込みするまで動かない）。
 * 拡張のインストール・更新時と、サービスを許可したときに、自分で注入する。
 */
const injectIntoOpenTabs = async (services: ServiceDefinition[]) => {
  for (const service of services) {
    const tabs = await chrome.tabs.query({ url: service.matches }).catch(() => []);
    for (const tab of tabs) {
      if (tab.id === undefined || tab.discarded) continue;
      const target = { tabId: tab.id };
      // 登録したものと同じ順（main-world.js → 補助スクリプト → adapter）で入れる
      for (const script of contentScriptsFor(service)) {
        await chrome.scripting
          .executeScript({ target, files: script.js ?? [], world: script.world ?? "ISOLATED" })
          .catch(() => {
            // 読み込み中のタブなどには注入できないことがある（その場合は再読み込みで動く）
          });
      }
    }
  }
};

chrome.runtime.onInstalled.addListener(() => {
  void registerContentScripts().then(injectIntoOpenTabs);
});

// ポップアップでサービスを許可した・外した（Chrome の設定画面から外した場合も届く）
chrome.permissions.onAdded.addListener((permissions) => {
  void registerContentScripts().then((granted) => {
    const added = granted.filter((service) =>
      service.matches.some((pattern) => permissions.origins?.includes(pattern)),
    );
    void injectIntoOpenTabs(added);
  });
});
chrome.permissions.onRemoved.addListener((permissions) => {
  const removed = SERVICES.filter((service) =>
    service.matches.some((pattern) => permissions.origins?.includes(pattern)),
  );
  stopPlayers(removed.map((service) => service.id));
  void registerContentScripts();
});
