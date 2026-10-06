// Nowstr: 拡張のアイコンを押したときのポップアップ。
// service worker に "popup" ポートでつなぎ、再生中の曲と投稿の状態を表示して、投稿の設定を変える。
// 設定の保存先は chrome.storage.local（service worker が保存する）。

import type { PublisherConfig, PublisherInfo } from "./protocol";
import { MUSIC_SERVICE_LABELS, type PlaybackState } from "./core/playback";
import { shortenNpub, toNpub } from "./core/npub";
import { grantedServices, SERVICES } from "./services";
import type { StatusPhase } from "./status/music-status-controller";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const enabled = $<HTMLInputElement>("enabled");
const clearOnClose = $<HTMLInputElement>("clear-on-close");
const fallback = $<HTMLTextAreaElement>("fallback");

const PHASE_LABELS: Record<StatusPhase, string> = {
  idle: "待機中（曲を再生すると投稿します）",
  sending: "送信中…",
  published: "掲示中",
  cleared: "消去しました",
  error: "送信に失敗しました",
};

let info: PublisherInfo | null = null;
let grantedCount = 0;
let lastPlayback: PlaybackState | null = null;
let fallbackEdited = false;

$("version").textContent = `v${chrome.runtime.getManifest().version}`;

const port = chrome.runtime.connect({ name: "popup" });

const configure = (patch: Partial<PublisherConfig>) => {
  if (!info) return;
  port.postMessage({ type: "configure", config: { ...info.config, ...patch } });
};

const renderPlayback = (state: PlaybackState | null) => {
  lastPlayback = state;
  const track = state?.track;
  $("playing-source").textContent = track ? MUSIC_SERVICE_LABELS[track.source] : "再生中の曲";
  $("playing-title").textContent = track ? track.title : "なし";
  $("playing-sub").textContent = track
    ? `${track.artists.join(", ")}${state.paused ? "（一時停止中）" : ""}`
    : grantedCount === 0
      ? "「使うサービス」をオンにしてください"
      : "オンにしたサービスのタブで再生すると表示されます";
};

const renderPublisher = (next: PublisherInfo) => {
  info = next;
  const { config } = next;
  enabled.checked = config.enabled;
  clearOnClose.checked = config.clearOnClose;
  clearOnClose.disabled = !config.enabled;

  $("status").hidden = !config.enabled;
  $("status-dot").dataset.phase = next.phase;
  $("status-text").textContent =
    next.phase === "published" && next.content
      ? `${PHASE_LABELS.published}: ${next.content}`
      : PHASE_LABELS[next.phase];
  $("pubkey").textContent = !config.enabled
    ? "オフのときは投稿しません"
    : next.pubkey
      ? shortenNpub(toNpub(next.pubkey))
      : "公開鍵は、曲を再生したときに音楽サービスのタブの NIP-07 拡張から取得します";
  const error = $("error");
  error.hidden = !config.enabled || !next.error;
  error.textContent = next.error ?? "";

  $("relay-source").textContent =
    next.relays.length === 0
      ? "公開鍵が分かると、投稿先の relay を調べます"
      : next.relaySource === "nip65"
        ? "NIP-65 relay list (kind:10002) の write relay に投稿します"
        : "relay list が見つからないため、fallback relay に投稿します";
  $("relays").replaceChildren(
    ...next.relays.map((relay) =>
      Object.assign(document.createElement("li"), { textContent: relay }),
    ),
  );
  // 入力中の内容は上書きしない
  if (!fallbackEdited) fallback.value = config.fallbackRelays.join("\n");
};

port.onMessage.addListener((message: { type?: string; state?: unknown; info?: unknown }) => {
  if (message?.type === "playback") renderPlayback(message.state as PlaybackState | null);
  else if (message?.type === "publisher") renderPublisher(message.info as PublisherInfo);
});

enabled.addEventListener("change", () => configure({ enabled: enabled.checked }));
clearOnClose.addEventListener("change", () => configure({ clearOnClose: clearOnClose.checked }));
fallback.addEventListener("input", () => {
  fallbackEdited = true;
  $("saved").hidden = true;
});
$("save").addEventListener("click", () => {
  fallbackEdited = false;
  // 形式の確認と、空のときの既定値への置き換えは service worker が行う
  configure({ fallbackRelays: fallback.value.split(/\s+/).filter(Boolean) });
  $("saved").hidden = false;
});

/**
 * サービスごとのスイッチ。オン・オフはサイトへのアクセス権限そのもの（services.ts）。
 * 権限の確認ダイアログでポップアップが閉じることがあるが、登録は service worker が permissions.onAdded で行う。
 */
const renderServices = async () => {
  const granted = new Set((await grantedServices()).map((service) => service.id));
  grantedCount = granted.size;
  $("services").replaceChildren(
    ...SERVICES.map((service) => {
      const row = document.createElement("label");
      row.className = "row";
      const name = document.createElement("span");
      name.textContent = service.label;
      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "switch";
      input.checked = granted.has(service.id);
      input.addEventListener("change", () => {
        // 権限の要求はクリックの処理の中で同期的に始める必要がある
        const request = input.checked
          ? chrome.permissions.request({ origins: service.matches })
          : chrome.permissions.remove({ origins: service.matches });
        void request.finally(() => void renderServices());
      });
      row.append(name, input);
      return row;
    }),
  );
  renderPlayback(lastPlayback);
};

chrome.permissions.onAdded.addListener(() => void renderServices());
chrome.permissions.onRemoved.addListener(() => void renderServices());

renderPlayback(null);
void renderServices();
