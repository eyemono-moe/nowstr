import { type JSX, Match, Show, Switch } from "solid-js";
import { shortenNpub, toNpub } from "../core/npub";
import { SOURCE_URL } from "../lib/links";
import { loginNostr, logoutNostr, nostr } from "../state/nostr";
import { activeSource } from "../state/source";
import {
  DEVICE_NAME,
  loginSpotify,
  logoutSpotify,
  playback,
  retryPlayer,
  spotify,
  transferHere,
} from "../state/spotify";
import { extensionDetected, youtubePlayback } from "../state/youtube";

const Step = (props: {
  index: number;
  done: boolean;
  title: string;
  status?: JSX.Element;
  action?: JSX.Element;
  children?: JSX.Element;
}) => (
  <li class="flex gap-3">
    <span
      class={`mt-0.5 h-6 w-6 flex shrink-0 items-center justify-center rounded-full text-xs font-bold ${
        props.done ? "bg-accent text-accent-fg" : "bg-surface-hover text-muted"
      }`}
    >
      <Show when={props.done} fallback={props.index}>
        <div class="i-lucide-check text-sm" />
      </Show>
    </span>
    <div class="min-w-0 flex flex-1 flex-col gap-1">
      <div class="min-h-8 flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm font-medium">{props.title}</p>
          <Show when={props.status}>
            <p class="break-all text-xs text-muted">{props.status}</p>
          </Show>
        </div>
        <div class="shrink-0">{props.action}</div>
      </div>
      {props.children}
    </div>
  </li>
);

const SmallLink = (props: { onClick: () => void; children: JSX.Element }) => (
  <button type="button" class="link text-xs" onClick={() => props.onClick()}>
    {props.children}
  </button>
);

const SpotifyStep = () => (
  <Step
    index={1}
    done={spotify.loggedIn && spotify.player === "ready"}
    title="Spotify にログイン"
    status={
      <Switch>
        <Match when={!spotify.configured}>Client ID が設定されていません</Match>
        <Match when={spotify.loggedIn && spotify.player === "ready"}>ログイン済み</Match>
        <Match when={spotify.loggedIn && spotify.player === "error"}>利用できません</Match>
        <Match when={spotify.loggedIn}>接続中…</Match>
        <Match when={!spotify.loggedIn}>Spotify Premium のアカウントが必要です</Match>
      </Switch>
    }
    action={
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
        <SmallLink onClick={logoutSpotify}>ログアウト</SmallLink>
      </Show>
    }
  >
    <Show when={spotify.player === "error" || spotify.player === "offline"}>
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <span class={spotify.player === "error" ? "text-danger" : "text-muted"}>
          {spotify.player === "offline" ? "Spotify との接続が切れました。" : spotify.error?.message}
        </span>
        <Show when={spotify.error?.code !== "spotify_premium_required"}>
          <SmallLink onClick={retryPlayer}>再接続</SmallLink>
        </Show>
      </div>
    </Show>
  </Step>
);

const NostrStep = () => (
  <Step
    index={2}
    done={nostr.pubkey !== null}
    title="Nostr にログイン"
    status={
      <Switch fallback="NIP-07 対応のブラウザ拡張（nos2x, Alby など）を使います">
        <Match when={nostr.connecting}>接続中…</Match>
        <Match when={nostr.pubkey}>{(pubkey) => shortenNpub(toNpub(pubkey()))}</Match>
        <Match when={nostr.nip07Available === false}>
          NIP-07 対応のブラウザ拡張が見つかりません
        </Match>
      </Switch>
    }
    action={
      <Show
        when={nostr.pubkey}
        fallback={
          <button
            type="button"
            class="btn-primary px-3 py-1.5 text-sm"
            disabled={nostr.connecting}
            onClick={() => void loginNostr()}
          >
            ログイン
          </button>
        }
      >
        <SmallLink onClick={() => void logoutNostr()}>ログアウト</SmallLink>
      </Show>
    }
  />
);

const LinkStep = () => {
  const linked = () => playback() !== null;
  return (
    <Step
      index={3}
      done={linked()}
      title="連携をはじめる"
      status={linked() ? "連携中" : "Spotify で再生中の曲を、このタブで流しはじめます"}
      action={
        <button
          type="button"
          class={`${linked() ? "btn-secondary" : "btn-primary"} px-3 py-1.5 text-sm`}
          disabled={spotify.player !== "ready"}
          onClick={transferHere}
        >
          <div class="i-lucide-play" />
          {linked() ? "もう一度" : "はじめる"}
        </button>
      }
    />
  );
};

const Note = (props: { icon: string; children: JSX.Element }) => (
  <li class="flex gap-2">
    <div class={`${props.icon} mt-0.5 shrink-0`} />
    <span>{props.children}</span>
  </li>
);

const Notes = (props: { children: JSX.Element }) => (
  <ul class="flex flex-col gap-1.5 border-t border-fg/10 pt-3 text-xs text-muted leading-relaxed">
    {props.children}
  </ul>
);

const StatusNote = () => (
  <Note icon="i-lucide-zap">
    このタブを開いている間、再生中の曲が Nostr
    のステータスに表示されます。一時停止するとステータスは消えます。タブを閉じたときも消去を試みますが、消せなかった場合でも曲の終了予定時刻には自動で消えます。
  </Note>
);

/**
 * Spotify: 内部的には「再生をこのブラウザ（Nowstr デバイス）へ移す」操作だが、利用者にはその仕組みを意識させない。
 */
const SpotifySetup = () => (
  <>
    <ol class="flex flex-col gap-4">
      <SpotifyStep />
      <NostrStep />
      <LinkStep />
    </ol>
    <Notes>
      <Note icon="i-lucide-monitor">
        Spotify はいつもどおり Spotify
        アプリで操作できます（再生・一時停止・曲送り・音量など）。この Nowstr
        のタブも開いたままにしておいてください（連携中の音はこのタブから流れ、ステータスの署名・投稿もこのタブで行います）。
      </Note>
      <StatusNote />
      <Note icon="i-lucide-repeat">
        Spotify アプリで再生先を別の端末に切り替えると、連携は止まります。再開するときは、Spotify
        アプリの再生先の一覧から「{DEVICE_NAME}」を選ぶか、③ のボタンを押してください。
      </Note>
    </Notes>
  </>
);

/** 拡張の配布ページ（Chrome ウェブストア公開前なので GitHub Release の zip。インストール手順もそこに書いてある） */
const EXTENSION_GUIDE_URL = `${SOURCE_URL}/releases/latest`;

/**
 * YouTube Music: 再生は YouTube Music のタブで普段どおり行い、
 * ブラウザ拡張（Nowstr Bridge）が曲情報をこのタブへ届ける。
 */
const YouTubeMusicSetup = () => (
  <>
    <ol class="flex flex-col gap-4">
      <Step
        index={1}
        done={extensionDetected() === true}
        title="ブラウザ拡張をインストール"
        status={
          <Switch>
            <Match when={extensionDetected() === true}>Nowstr Bridge を検出しました</Match>
            <Match when={extensionDetected() === null}>確認中…</Match>
            <Match when={extensionDetected() === false}>
              YouTube Music の曲情報を受け取るために「Nowstr
              Bridge」拡張が必要です。インストール後、このページを再読み込みしてください
            </Match>
          </Switch>
        }
        action={
          <Show when={extensionDetected() !== true}>
            <a
              href={EXTENSION_GUIDE_URL}
              target="_blank"
              rel="noopener noreferrer"
              class="btn-primary px-3 py-1.5 text-sm"
            >
              入手方法
            </a>
          </Show>
        }
      />
      <NostrStep />
      <Step
        index={3}
        done={youtubePlayback() !== null}
        title="YouTube Music で再生"
        status={
          youtubePlayback() !== null
            ? "再生中の曲を受け取っています"
            : "別のタブで YouTube Music を開いて、曲を再生してください"
        }
        action={
          <a
            href="https://music.youtube.com/"
            target="_blank"
            rel="noopener noreferrer"
            class={`${youtubePlayback() !== null ? "btn-secondary" : "btn-primary"} px-3 py-1.5 text-sm`}
          >
            <div class="i-lucide-external-link" />
            開く
          </a>
        }
      />
    </ol>
    <Notes>
      <Note icon="i-lucide-monitor">
        YouTube Music はいつもどおりブラウザのタブで使えます。この Nowstr
        のタブも開いたままにしておいてください（ステータスの署名・投稿をこのタブで行います）。
      </Note>
      <StatusNote />
      <Note icon="i-lucide-smartphone">
        読み取れるのは、このブラウザの YouTube Music
        で再生している曲だけです（スマートフォンのアプリなどは対象外です）。
      </Note>
    </Notes>
  </>
);

/** はじめかた。手順の進み具合を表示しつつ、連携後も使い方の説明として残しておく。 */
export const SetupSteps = () => (
  <section class="card flex flex-col gap-4">
    <h2 class="font-semibold">はじめかた</h2>
    <Show when={activeSource() === "spotify"} fallback={<YouTubeMusicSetup />}>
      <SpotifySetup />
    </Show>
  </section>
);
