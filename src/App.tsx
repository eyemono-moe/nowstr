import { For, type JSX, onMount } from "solid-js";
import { DOWNLOAD_URL, RELEASES_URL } from "./lib/links";
import { Footer } from "./ui/Footer";
import { Logo } from "./ui/Logo";
import { PrivacyPolicy } from "./ui/PrivacyPolicy";

/**
 * Nowstr の案内ページ。投稿はブラウザ拡張 Nowstr が行うので、このページは説明だけを載せる静的な1枚にしている。
 * - 拡張のインストール方法と使い方
 * - 対応しているサイト
 * - プライバシーポリシー（拡張のポップアップから #privacy で開く）
 */

/** 配布している最新の拡張のバージョン（ビルド時に extension/manifest.json から埋め込む） */
const LATEST_VERSION = __LATEST_EXTENSION_VERSION__;

const SITES = [
  {
    name: "YouTube Music",
    url: "https://music.youtube.com/",
    notes: [
      "どのページ（ホーム・プレイリスト・ライブラリなど）で再生していても読み取れます",
      "広告の再生中は投稿しません",
      "限定公開・非公開の動画は、曲名だけを投稿してリンクは付けません",
    ],
  },
  {
    name: "Spotify",
    url: "https://open.spotify.com/",
    notes: [
      "ブラウザの Web Player（open.spotify.com）で再生している曲が対象です。Spotify Free でも使えます",
      "広告の再生中は投稿しません",
      "スマートフォンのアプリなど、他の端末で再生している曲は対象外です",
    ],
  },
  {
    name: "SoundCloud",
    url: "https://soundcloud.com/",
    notes: [
      "シークレットリンクで再生している曲や非公開の曲は、曲名だけを投稿してリンクは付けません",
    ],
  },
];

const Section = (props: { id: string; title: string; children: JSX.Element }) => (
  <section id={props.id} class="flex scroll-mt-6 flex-col gap-4">
    <h2 class="text-lg font-bold">{props.title}</h2>
    {props.children}
  </section>
);

const Steps = (props: { children: JSX.Element }) => (
  <ol class="flex flex-col gap-4">{props.children}</ol>
);

const Step = (props: { index: number; title: string; children?: JSX.Element }) => (
  <li class="flex gap-3">
    <span class="mt-0.5 h-6 w-6 flex shrink-0 items-center justify-center rounded-full bg-surface-hover text-xs text-muted font-bold">
      {props.index}
    </span>
    <div class="min-w-0 flex flex-col gap-1">
      <p class="text-sm font-medium">{props.title}</p>
      <div class="text-sm text-fg/80 leading-relaxed">{props.children}</div>
    </div>
  </li>
);

const Code = (props: { children: JSX.Element }) => (
  <code class="rounded bg-surface-hover px-1.5 py-0.5 text-xs font-mono">{props.children}</code>
);

const App = () => {
  // 拡張のポップアップから #privacy で開いたとき、描画後にその場所へ移動する
  onMount(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  });

  return (
    <div class="min-h-screen bg-bg text-fg">
      <div class="mx-auto max-w-2xl flex flex-col gap-12 px-6 py-8">
        <header class="flex flex-wrap items-center justify-between gap-4">
          <Logo />
          <nav class="flex gap-4 text-sm">
            <a href="#sites" class="link">
              対応サイト
            </a>
            <a href="#install" class="link">
              インストール
            </a>
            <a href="#privacy" class="link">
              プライバシー
            </a>
          </nav>
        </header>

        <div class="flex flex-col gap-4">
          <p class="text-2xl font-bold">いま聴いている曲を、Nostr に。</p>
          <p class="leading-relaxed">
            Nowstr は、ブラウザで再生している曲を Nostr
            のステータスとして自動で投稿するブラウザ拡張です。YouTube Music・Spotify・SoundCloud
            のタブで曲を再生するだけで、ステータスが更新されます。
          </p>
          <ul class="flex flex-col gap-1.5 text-sm text-fg/80 leading-relaxed">
            <li class="flex gap-2">
              <div class="i-lucide-zap mt-0.5 shrink-0 text-nostr" />
              曲が変わると更新し、一時停止したときや音楽サービスのタブを閉じたときは消します
            </li>
            <li class="flex gap-2">
              <div class="i-lucide-key-round mt-0.5 shrink-0 text-nostr" />
              秘密鍵は扱いません。署名は NIP-07 対応のブラウザ拡張（nos2x, Alby など）に依頼します
            </li>
            <li class="flex gap-2">
              <div class="i-lucide-hash mt-0.5 shrink-0 text-nostr" />
              NIP-38 の music status（kind:30315、d タグ "music"）として投稿します
            </li>
          </ul>
          <div class="flex flex-wrap items-center gap-3">
            <a href={DOWNLOAD_URL} class="btn-primary">
              <div class="i-lucide-download" />
              拡張をダウンロード
            </a>
            <span class="text-xs text-muted">
              v{LATEST_VERSION}（Chrome・Edge などの Chromium 系ブラウザ）
            </span>
          </div>
        </div>

        <Section id="sites" title="対応サイト">
          <div class="grid gap-3">
            <For each={SITES}>
              {(site) => (
                <div class="card flex flex-col gap-2">
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="self-start font-semibold hover:underline"
                  >
                    {site.name}
                  </a>
                  <ul class="flex flex-col gap-1 text-xs text-muted leading-relaxed">
                    <For each={site.notes}>{(note) => <li>・{note}</li>}</For>
                  </ul>
                </div>
              )}
            </For>
          </div>
          <p class="text-xs text-muted leading-relaxed">
            どのサイトも、このブラウザのタブで再生している曲だけが対象です。各サービス公式の連携方法ではないため、サービス側の画面が変わると動かなくなることがあります。
          </p>
        </Section>

        <Section id="install" title="インストールと使い方">
          <p class="text-sm text-fg/80 leading-relaxed">
            Chrome ウェブストアには未公開なので、配布している zip
            を「パッケージ化されていない拡張機能」として読み込みます。
          </p>
          <Steps>
            <Step index={1} title="NIP-07 対応のブラウザ拡張を用意する">
              Nostr の署名に使います（nos2x, Alby, AKA Profiles など）。Nowstr
              は秘密鍵を扱いません。
            </Step>
            <Step index={2} title="拡張をダウンロードして展開する">
              <a href={DOWNLOAD_URL} class="link">
                nowstr-extension.zip
              </a>
              （
              <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" class="link">
                Releases
              </a>
              ）をダウンロードして展開します。展開したフォルダは、使っている間は削除しないでください。
            </Step>
            <Step index={3} title="拡張を読み込む">
              <Code>chrome://extensions</Code> を開き、右上の「デベロッパー
              モード」をオンにして、「パッケージ化されていない拡張機能を読み込む」から展開したフォルダを選びます。
            </Step>
            <Step index={4} title="投稿をオンにする">
              ツールバーの Nowstr のアイコンを押してポップアップを開き、「Nostr
              に投稿」をオンにします。投稿先の relay や「タブを閉じたら消す」もここで設定できます。
            </Step>
            <Step index={5} title="曲を再生する">
              YouTube Music・Spotify・SoundCloud のタブで曲を再生します。はじめは、そのタブで NIP-07
              拡張の確認が表示されるので許可してください。
            </Step>
          </Steps>
          <div class="card flex flex-col gap-2 text-sm leading-relaxed">
            <p class="font-semibold">署名の許可について</p>
            <p class="text-fg/80">
              署名は、曲を再生している音楽サービスのタブで NIP-07
              拡張に依頼します。確認を毎回出したくない場合は、そのサイトに対して
              <strong> kind:30315 の署名だけ</strong>
              を「常に許可」にしてください。すべての kind
              を許可すると、そのサイトのスクリプトがほかの種類のイベントにも署名できてしまいます。
            </p>
          </div>
          <ul class="flex flex-col gap-1.5 text-xs text-muted leading-relaxed">
            <li>
              ・曲ごとに、投稿と「消去用のイベント」の2回署名します。消去用のイベントは、タブを閉じたときや一時停止したときに、署名を待たずに
              status を消すために使います（ポップアップでオフにできます）。
            </li>
            <li>
              ・ブラウザごと閉じたときなど消せなかった場合も、曲の終了予定時刻（NIP-40 の
              expiration）を過ぎると表示されなくなります。
            </li>
            <li>
              ・投稿先は、NIP-65 の relay list（kind:10002）の write relay です。見つからなければ
              fallback relay を使います。
            </li>
            <li>
              ・更新するときは、展開したフォルダの中身を新しい zip の内容に置き換えて、
              <Code>chrome://extensions</Code> で拡張の再読み込みボタンを押してください。
            </li>
          </ul>
        </Section>

        <PrivacyPolicy />

        <Footer />
      </div>
    </div>
  );
};

export default App;
