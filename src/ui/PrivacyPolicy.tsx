import type { JSX } from "solid-js";
import { CONTACT_URL } from "../lib/links";

const Section = (props: { title: string; children: JSX.Element }) => (
  <section class="flex flex-col gap-2">
    <h3 class="font-semibold">{props.title}</h3>
    <div class="flex flex-col gap-2 text-sm text-fg/85 leading-relaxed">{props.children}</div>
  </section>
);

/**
 * プライバシーポリシー。拡張のポップアップから `#privacy` 付きの URL で開く。
 * Nowstr はセルフホストされることもあるので、特定の運営者に依存しない書き方にしている。
 */
export const PrivacyPolicy = () => (
  <section id="privacy" class="card flex scroll-mt-6 flex-col gap-6 p-6">
    <h2 class="text-lg font-bold">プライバシーポリシー</h2>

    <Section title="概要">
      <p>
        Nowstr は、ブラウザで再生している曲を Nostr の music
        status（NIP-38）として投稿するブラウザ拡張と、その案内ページです。Nowstr
        にはサーバー（バックエンド）がなく、開発者・運営者があなたの情報を受け取ることはありません。
      </p>
    </Section>

    <Section title="拡張が扱う情報">
      <ul class="list-disc pl-5">
        <li>
          <strong>再生中の曲の情報</strong>
          （曲名・アーティスト名・アルバム名・アートワークの URL・曲の
          URL・再生位置・長さ・再生/一時停止の状態）：このブラウザで開いている YouTube
          Music・Spotify・SoundCloud
          のタブの状態から読み取り、ステータスの投稿とポップアップの表示に使います。各サービスのアカウント情報や再生履歴は取得しません。
        </li>
        <li>
          <strong>Nostr の公開鍵</strong>：NIP-07 対応のブラウザ拡張から取得し、あなたの relay
          list（NIP-65）の取得と投稿に使います。秘密鍵は扱わず、署名は NIP-07
          対応のブラウザ拡張に依頼します。署名の依頼は、曲を再生している音楽サービスのタブで行います。
        </li>
      </ul>
    </Section>

    <Section title="保存する情報">
      <p>
        拡張は次の情報を、このブラウザの拡張用ストレージ（chrome.storage.local）にだけ保存します。拡張の動作が途中で止まっても、続きから投稿したり
        status を消したりできるようにするためです。
      </p>
      <ul class="list-disc pl-5">
        <li>設定（投稿のオン・オフ、fallback relay、タブを閉じたら消すか）</li>
        <li>Nostr の公開鍵と、投稿先の relay</li>
        <li>最後に掲示した status と、それを消すための署名済みの消去イベント</li>
      </ul>
      <p>再生した曲の履歴は保存しません。</p>
    </Section>

    <Section title="外部への送信">
      <p>拡張が通信するのは Nostr relay だけです。</p>
      <ul class="list-disc pl-5">
        <li>
          <strong>relay list の取得</strong>：あなたの公開鍵を使って、relay list（kind:10002）を
          fallback relay と、relay list が集まりやすい relay（wss://purplepag.es,
          wss://directory.yabu.me）に問い合わせます。
        </li>
        <li>
          <strong>music status の投稿</strong>
          ：曲名・アーティスト名・曲のリンク（open.spotify.com・music.youtube.com・soundcloud.com の
          URL）・曲の終了予定時刻を、あなたの鍵で署名した<strong>公開イベント</strong>
          として、あなたの write relay（または fallback relay）に送信します。Nostr
          の性質上、この情報は誰でも閲覧でき、第三者が保存する可能性があります。限定公開・非公開の曲にはリンクを付けません。
        </li>
        <li>
          <strong>status の消去</strong>
          ：一時停止したときやタブを閉じたときに、内容が空の公開イベントを送信します。終了予定時刻（NIP-40
          の expiration）を過ぎたイベントの削除は、各 relay の実装に依存します。
        </li>
      </ul>
    </Section>

    <Section title="このウェブページ">
      <p>
        このページは説明を表示するだけで、情報を保存・送信しません。アクセス解析ツールや広告、トラッキング用の
        Cookie も使用しません。ただし、このサイトをホスティングしているサービス（Cloudflare
        など）が、通常のウェブサーバーと同様にアクセスログ（IP
        アドレス等）を記録する場合があります。
      </p>
    </Section>

    <Section title="投稿の停止とデータの削除">
      <ul class="list-disc pl-5">
        <li>
          拡張のポップアップで「Nostr に投稿」をオフにすると、投稿を止め、掲示中の status
          を消します。
        </li>
        <li>拡張を削除すると、拡張が保存したすべての情報が消えます。</li>
        <li>
          Nostr に投稿済みの music status は公開イベントのため、Nowstr
          から完全に削除することはできません。
        </li>
      </ul>
    </Section>

    <Section title="お問い合わせ">
      <p>
        このポリシーに関するお問い合わせは、
        <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer" class="link">
          こちら
        </a>
        までお願いします。
      </p>
    </Section>

    <p class="text-xs text-muted">制定日: 2026年10月2日 / 改定日: 2026年10月5日</p>
  </section>
);
