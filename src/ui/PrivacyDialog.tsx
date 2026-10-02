import { Dialog } from "@ark-ui/solid/dialog";
import { createSignal, type JSX, onCleanup, onMount } from "solid-js";
import { Portal } from "solid-js/web";
import { CONTACT_URL, SPOTIFY_APPS_URL } from "../lib/links";

const Section = (props: { title: string; children: JSX.Element }) => (
  <section class="flex flex-col gap-2">
    <h3 class="font-semibold">{props.title}</h3>
    <div class="flex flex-col gap-2 text-sm text-fg/85 leading-relaxed">{props.children}</div>
  </section>
);

const ExternalLink = (props: { href: string; children: JSX.Element }) => (
  <a href={props.href} target="_blank" rel="noopener noreferrer" class="link">
    {props.children}
  </a>
);

const PRIVACY_HASH = "#privacy";

/**
 * プライバシーポリシー（Spotify Developer Policy で提供が必須）。
 * Nowstr はセルフホストされる前提なので、特定の運営者に依存しない書き方にしている。
 *
 * ページ遷移すると再生が止まってしまうため、ダイアログで表示する。
 * `#privacy` 付きの URL で直接開くこともできる（Spotify Dashboard 等に登録する URL 用）。
 */
export const PrivacyDialog = () => {
  const [open, setOpen] = createSignal(location.hash === PRIVACY_HASH);

  onMount(() => {
    const onHashChange = () => setOpen(location.hash === PRIVACY_HASH);
    window.addEventListener("hashchange", onHashChange);
    onCleanup(() => window.removeEventListener("hashchange", onHashChange));
  });

  const close = () => {
    setOpen(false);
    if (location.hash === PRIVACY_HASH) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  };

  return (
    <Dialog.Root open={open()} onOpenChange={({ open }) => (open ? setOpen(true) : close())}>
      <Dialog.Trigger class="link">プライバシーポリシー</Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content class="max-h-[85vh] max-w-2xl w-full flex flex-col overflow-hidden rounded-2xl bg-surface text-fg shadow-2xl outline-none">
            <header class="flex items-center justify-between border-b border-fg/10 px-6 py-4">
              <Dialog.Title class="text-lg font-semibold">プライバシーポリシー</Dialog.Title>
              <Dialog.CloseTrigger class="btn-icon" aria-label="閉じる">
                <div class="i-lucide-x" />
              </Dialog.CloseTrigger>
            </header>
            <div class="flex flex-col gap-6 overflow-y-auto px-6 py-5">
              <Section title="概要">
                <p>
                  Nowstr は、このブラウザで再生している Spotify の曲を Nostr の music status
                  として掲示するためのウェブアプリです。Nowstr
                  は独自のサーバーを持たず、すべての処理はあなたのブラウザの中で行われます。Nowstr
                  の運営者（このサイトをホスティングしている人）が、あなたの Spotify や Nostr
                  のデータを受け取ったり保存したりすることはありません。
                </p>
              </Section>

              <Section title="取得する情報と利用目的">
                <ul class="list-disc pl-5">
                  <li>
                    <strong>Spotify のアクセストークン</strong>
                    ：このブラウザを Spotify の再生デバイスとして動作させるために使います。
                  </li>
                  <li>
                    <strong>このブラウザで再生中の曲の情報</strong>
                    （曲名・アーティスト名・アルバム名・アートワーク・Spotify
                    URI・再生位置・再生/一時停止の状態） ：画面への表示と、Nostr の music status
                    の作成に使います。Spotify
                    アカウント全体の再生履歴や、他のデバイスでの再生状況は取得しません。
                  </li>
                  <li>
                    <strong>Nostr の公開鍵</strong>
                    ：あなたの relay list（NIP-65）の取得と、music status の投稿に使います。秘密鍵は
                    Nowstr では扱わず、署名はブラウザ拡張（NIP-07）が行います。
                  </li>
                </ul>
                <p>
                  Spotify Web Playback SDK
                  の要件により、ログイン時にメールアドレス等の参照権限（user-read-email /
                  user-read-private）を求めますが、Nowstr
                  はこれらのアカウント情報を取得・保存しません。
                </p>
              </Section>

              <Section title="保存場所">
                <p>
                  Spotify のトークンと設定（music status 投稿の ON/OFF、fallback relay
                  など）は、あなたのブラウザの localStorage
                  にのみ保存されます。再生中の曲の情報は保存しません。
                </p>
              </Section>

              <Section title="外部への送信">
                <ul class="list-disc pl-5">
                  <li>
                    <strong>Spotify</strong>：再生とデバイスの切り替えのため、Spotify の API / Web
                    Playback SDK と通信します。
                  </li>
                  <li>
                    <strong>Nostr relay</strong>：再生中の曲の music
                    status（曲名・アーティスト名・Spotify
                    URI・曲の終了予定時刻）を、あなたの鍵で署名した<strong>公開イベント</strong>
                    として、あなたの write relay（または設定した fallback relay）に送信します。Nostr
                    の性質上、この情報は誰でも閲覧でき、第三者が保存する可能性があります。終了予定時刻（NIP-40
                    の expiration）を過ぎたイベントの削除は各 relay の実装に依存します。
                  </li>
                </ul>
                <p>
                  タブを閉じたときにステータスを消すため、ステータスを消去するイベント（内容が空の公開イベント）にも前もって署名し、タブを閉じる際に送信します。music
                  status の投稿とこの消去は、設定画面からいつでもオフにできます。
                </p>
              </Section>

              <Section title="アクセス解析・Cookie">
                <p>
                  Nowstr はアクセス解析ツールや広告、トラッキング用の Cookie を使用しません。
                  ただし、このサイトをホスティングしているサービス（Cloudflare
                  など）が、通常のウェブサーバーと同様にアクセスログ（IP
                  アドレス等）を記録する場合があります。
                </p>
              </Section>

              <Section title="連携の解除とデータの削除">
                <ul class="list-disc pl-5">
                  <li>
                    Nowstr の「ログアウト」で、このブラウザに保存された Spotify
                    のトークンを削除できます。
                  </li>
                  <li>
                    Spotify 側でのアクセス許可は、
                    <ExternalLink href={SPOTIFY_APPS_URL}>
                      Spotify のアカウントページ（アプリ）
                    </ExternalLink>
                    から取り消せます。
                  </li>
                  <li>
                    ブラウザの設定からこのサイトのデータを削除すると、Nowstr
                    が保存したすべての情報が消えます。
                  </li>
                  <li>
                    Nostr に投稿済みの music status は公開イベントのため、Nowstr
                    から完全に削除することはできません。
                  </li>
                </ul>
              </Section>

              <Section title="お問い合わせ">
                <p>
                  このポリシーに関するお問い合わせは、
                  <ExternalLink href={CONTACT_URL}>こちら</ExternalLink>までお願いします。
                </p>
              </Section>

              <p class="text-xs text-muted">制定日: 2026年10月2日</p>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
