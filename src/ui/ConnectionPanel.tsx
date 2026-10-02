import { Match, Show, Switch } from "solid-js";
import { shortenNpub, toNpub } from "../core/npub";
import { loginNostr, logoutNostr, nostr } from "../state/nostr";
import { loginSpotify, logoutSpotify, spotify } from "../state/spotify";

const Dot = (props: { ok: boolean; warn?: boolean }) => (
  <span
    class={`h-2 w-2 shrink-0 rounded-full ${props.ok ? "bg-accent" : props.warn ? "bg-yellow-400" : "bg-muted/50"}`}
  />
);

const SpotifyRow = () => (
  <div class="flex items-center justify-between gap-3">
    <div class="min-w-0 flex items-center gap-2">
      <Dot ok={spotify.player === "ready"} warn={spotify.loggedIn && spotify.player !== "ready"} />
      <div class="i-lucide-music-2 text-muted" />
      <span class="text-sm font-medium">Spotify</span>
      <span class="truncate text-xs text-muted">
        <Switch fallback="未ログイン">
          <Match when={!spotify.configured}>Client ID 未設定</Match>
          <Match when={spotify.loggedIn && spotify.player === "ready"}>接続済み</Match>
          <Match when={spotify.loggedIn && spotify.player === "error"}>プレイヤー利用不可</Match>
          <Match when={spotify.loggedIn}>接続中…</Match>
        </Switch>
      </span>
    </div>
    <Show
      when={spotify.loggedIn}
      fallback={
        <button
          type="button"
          class="btn-primary px-3 py-1.5 text-sm"
          disabled={!spotify.configured}
          onClick={loginSpotify}
        >
          ログイン
        </button>
      }
    >
      <button type="button" class="btn-secondary px-3 py-1.5 text-sm" onClick={logoutSpotify}>
        ログアウト
      </button>
    </Show>
  </div>
);

const NostrRow = () => (
  <div class="flex items-center justify-between gap-3">
    <div class="min-w-0 flex items-center gap-2">
      <Dot ok={nostr.pubkey !== null} />
      <div class="i-lucide-zap text-nostr" />
      <span class="text-sm font-medium">Nostr</span>
      <span class="truncate text-xs text-muted">
        <Switch fallback="未接続">
          <Match when={nostr.connecting}>接続中…</Match>
          <Match when={nostr.pubkey}>{(pubkey) => shortenNpub(toNpub(pubkey()))}</Match>
          <Match when={nostr.nip07Available === null}>拡張を確認中…</Match>
          <Match when={nostr.nip07Available === false}>NIP-07 拡張が見つかりません</Match>
        </Switch>
      </span>
    </div>
    <Show
      when={nostr.pubkey}
      fallback={
        <button
          type="button"
          class="btn px-3 py-1.5 text-sm bg-nostr text-white hover:brightness-110"
          disabled={nostr.connecting}
          title={
            nostr.nip07Available === false
              ? "nos2x や Alby などの NIP-07 拡張が必要です"
              : undefined
          }
          onClick={() => void loginNostr()}
        >
          NIP-07 でログイン
        </button>
      }
    >
      <button
        type="button"
        class="btn-secondary px-3 py-1.5 text-sm"
        onClick={() => void logoutNostr()}
      >
        ログアウト
      </button>
    </Show>
  </div>
);

export const ConnectionPanel = () => (
  <section class="card flex flex-col gap-3">
    <SpotifyRow />
    <NostrRow />
    <Show when={!spotify.configured}>
      <p class="text-xs text-danger">
        VITE_SPOTIFY_CLIENT_ID が設定されていません。README の手順で Spotify Developer App
        を作成してください。
      </p>
    </Show>
    <Show when={spotify.loggedIn && !nostr.pubkey}>
      <p class="text-xs text-muted">
        Nostr 未接続でも再生できます（music status の投稿のみ無効）。
      </p>
    </Show>
  </section>
);
