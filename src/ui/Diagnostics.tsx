import { createMemo, For } from "solid-js";
import type { PlaybackState } from "../core/playback";
import { nostr } from "../state/nostr";
import { activePlayback, activeSource } from "../state/source";
import { spotify } from "../state/spotify";
import { notifyInfo } from "../state/toast";
import {
  extensionDetected,
  extensionVersion,
  LATEST_EXTENSION_VERSION,
  lastMessageAt,
  youtubePlayback,
} from "../state/youtube";

const describePlayback = (state: PlaybackState | null): string => {
  if (!state) return "null";
  const track = state.track
    ? `${state.track.title} / ${state.track.artists.join(", ")}`
    : "(track なし)";
  const sec = (ms: number) => Math.round(ms / 1000);
  return `${track} ${state.paused ? "⏸" : "▶"} ${sec(state.positionMs)}/${sec(state.durationMs)}s`;
};

const time = (at: number | null) => (at ? new Date(at).toLocaleTimeString() : "-");

/** 動作確認・不具合報告用に、いまの状態をまとめて表示する */
export const Diagnostics = () => {
  const rows = createMemo(() => [
    ["再生元", activeSource()],
    ["再生中（再生元）", describePlayback(activePlayback())],
    [
      "拡張 Nowstr Bridge",
      extensionDetected() === null
        ? "確認中"
        : extensionDetected()
          ? `検出 (v${extensionVersion() ?? "?"}, 最新 v${LATEST_EXTENSION_VERSION})`
          : "未検出",
    ],
    ["拡張から最後に受信", time(lastMessageAt())],
    ["YouTube Music の状態", describePlayback(youtubePlayback())],
    ["Spotify", `${spotify.loggedIn ? "ログイン済み" : "未ログイン"} / player=${spotify.player}`],
    [
      "Nostr",
      nostr.pubkey
        ? `ログイン済み / relay ${nostr.relays.length} 件 (${nostr.relaySource})`
        : "未ログイン",
    ],
    ["ステータス", `${nostr.status.phase} ${nostr.status.status?.content ?? ""}`],
    ["ページ", `${location.origin} / ${navigator.userAgent}`],
  ]);

  const copy = async () => {
    const text = rows()
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    await navigator.clipboard.writeText(text);
    notifyInfo("診断情報をコピーしました");
  };

  return (
    <details class="flex flex-col gap-2">
      <summary class="cursor-pointer font-medium">診断情報</summary>
      <p class="mt-2 text-xs text-muted">
        うまく連携されないときの確認用です。不具合を報告するときは、コピーして添えてください。
      </p>
      <dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <For each={rows()}>
          {([key, value]) => (
            <>
              <dt class="text-muted">{key}</dt>
              <dd class="break-all font-mono">{value}</dd>
            </>
          )}
        </For>
      </dl>
      <button
        type="button"
        class="btn-secondary mt-2 self-start text-sm"
        onClick={() => void copy()}
      >
        <div class="i-lucide-copy" />
        コピー
      </button>
    </details>
  );
};
