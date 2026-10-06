# Nowstr

ブラウザで再生中の曲を、Nostr のステータス（[NIP-38](https://github.com/nostr-protocol/nips/blob/master/38.md) の music status）として自動で投稿するブラウザ拡張です。

- **YouTube Music・Spotify（Web Player）・SoundCloud・Amazon Music・Nintendo Music** のタブで曲を再生するだけで、ステータスが更新されます。Spotify は Web Player の画面から読むので、Spotify Free でも使えます
- 曲の開始・変更・一時停止・再開に合わせて、`kind:30315` / `d=music` の status を publish / clear します（`r` タグには曲の URL を入れます）
- 秘密鍵は扱いません。署名は NIP-07 対応のブラウザ拡張（nos2x, Alby など）に依頼します
- 設定と状態の確認は、拡張のアイコンを押して開くポップアップで行います

[nowstr.eyemono.moe](https://nowstr.eyemono.moe/) は、インストール方法・対応サイト・プライバシーポリシーを載せた案内ページです（静的な1ページで、投稿などの処理は行いません）。

## 必要環境

| 項目     | 要件                                                               |
| -------- | ------------------------------------------------------------------ |
| ブラウザ | デスクトップ版 Chromium 系（Chrome / Edge / Brave / Vivaldi など） |
| Nostr    | **NIP-07 対応のブラウザ拡張**（nos2x, Alby, AKA Profiles など）    |
| 開発     | Node.js 24 系, [Vite+](https://viteplus.dev/) (`vp`), pnpm         |

## インストールと使い方

Chrome ウェブストアには未公開なので、配布している zip を「パッケージ化されていない拡張機能」として読み込みます。

1. [Releases](https://github.com/eyemono-moe/nowstr/releases/latest) から **nowstr-extension.zip** をダウンロードして展開する（[直接ダウンロード](https://github.com/eyemono-moe/nowstr/releases/latest/download/nowstr-extension.zip)）
2. `chrome://extensions` を開き、右上の **デベロッパー モード** をオンにする
3. **パッケージ化されていない拡張機能を読み込む** から、展開したフォルダを選ぶ
4. ツールバーの Nowstr のアイコンを押してポップアップを開き、**Nostr に投稿** をオンにする
5. YouTube Music・Spotify・SoundCloud・Amazon Music・Nintendo Music のタブで曲を再生する。はじめは、そのタブで NIP-07 拡張の確認が表示されるので許可する

ポップアップでは、再生中の曲・投稿の状態・公開鍵・投稿先 relay を確認でき、fallback relay と「タブを閉じたら消す」を設定できます。アイコンには、投稿中は「ON」、送信に失敗すると「!」が表示されます。

- 展開したフォルダは削除しないでください（Chrome はそのフォルダから拡張を読み込み続けます）。
- 更新するときは、フォルダの中身を新しい zip の内容に置き換えて、`chrome://extensions` で拡張の再読み込みボタンを押してください。自動更新はされません。
- インストール・更新した時点で開いていた音楽サービスのタブには、拡張が自動でスクリプトを入れ直します。うまく動かない場合はタブを再読み込みしてください。

### 署名の許可について

署名は、曲を再生している音楽サービスのタブで NIP-07 拡張に依頼します。確認を毎回出したくない場合は、そのサイトに対して **kind:30315 の署名だけ** を「常に許可」にしてください。すべての kind を許可すると、そのサイトのスクリプトがほかの種類のイベントにも署名できてしまいます（[セキュリティ](#セキュリティ)）。

曲ごとに、投稿と「消去用のイベント」の2回署名します。消去用のイベントは、タブを閉じたときや一時停止したときに、署名を待たずに status を消すために使います（ポップアップでオフにできます）。

### 対応サイトと制約

| サービス       | 曲名など                                  | 再生状態・位置・長さ                               | サービス固有の処理                                                                                                                |
| -------------- | ----------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| YouTube Music  | mediaSession.metadata                     | `<video>`                                          | 動画 ID（プレイヤーの `getVideoData()`）、限定公開の判定、広告（`.ad-showing`）の除外                                             |
| Spotify        | mediaSession.metadata                     | document 外の media 要素（なければ再生バーの表示） | 曲の ID（再生バーの React の props から探す。なければアルバムのリンク）、広告の除外                                               |
| SoundCloud     | mediaSession.metadata                     | document 外の `<audio>`                            | 曲の URL（再生バーのリンク）、非公開の曲の判定                                                                                    |
| Amazon Music   | mediaSession.metadata                     | document 外の `<audio>`                            | 曲へのリンクが取れないので検索結果の URL、広告（再生バーの `primary-href`）の除外                                                 |
| Nintendo Music | mediaSession.metadata（ゲーム名は album） | `<video>` ではなく document 内の `<audio>`         | 曲の ID（再生バーの React の props から探す）で共有用リンク（`/shared/<言語>/<国>/tracks/<id>/`）。アーティストの代わりにゲーム名 |

- 対象は、このブラウザのタブで再生している曲だけです。スマートフォンのアプリや、Spotify Connect で他の端末から再生している曲は取得できません。
- 広告の再生中は投稿しません（Spotify はアーティストのリンクがないことで判定します）。SoundCloud の音声広告は判定していません。
- Amazon Music は、画面にも曲（ASIN）へのリンクがないため、曲名とアーティスト名での検索結果へのリンクを付けます。
- MV など、アルバムがない曲はアルバム名が空になります。
- 各サービス公式の連携方法ではありません。ユーザーが自分で開いているページの状態を読むだけで、各サービスのサーバーへの自動アクセスは行いません。曲名と再生状態は標準の mediaSession と media 要素から読むので比較的壊れにくいですが、画面構成が変わると曲の URL などが取れなくなる可能性があります。
- 拡張を入れ直した直後は、次に再生・一時停止・曲送りをしたときから読み取りが始まることがあります。
- 音楽サービスのタブを再読み込みすると、status はいったん消えてから再び投稿されます。

## 仕組み

```text
[音楽サービスのタブ]
  content/main-world.js (MAIN world)  再生中の media 要素（document 外の <audio> も）と mediaSession の変化を拾う / NIP-07 の中継
  content/source.js                    mediaSession.metadata と media 要素から読む共通処理
  content/sources/<service>.js         サービスごとの差分だけ（曲の URL・広告の判定など）
        ↓ chrome.runtime（"player" ポート。状態が変わったときだけ送る）
[service worker]  extension/src/background.ts（ビルドして extension/dist/background.js）
  タブごとの状態をまとめる → MusicStatusController → 音楽サービスのタブで NIP-07 署名 → 検証 → relay
        ↕ "popup" ポート
[ポップアップ]  extension/popup/ + extension/src/popup.ts
```

- **ポーリングはしません。** media 要素のイベント（再生・一時停止・seek・曲の読み込み）と、`mediaSession.metadata` / `playbackState` への代入（曲の切り替え）を MAIN world で拾い、そのときだけ状態を読みます。曲の URL など画面から読むものは少し遅れて変わるので、イベントのあと 50 / 500 / 2000 ミリ秒後に読み直します。
- **service worker は止まってよい**設計です。何も起きなければ Chrome が止め、次のように起こされます。
  - 再生状態が変わった: content script がつなぎ直して送る
  - タブを閉じた・別のページへ移動した: `tabs.onRemoved` / `tabs.onUpdated`
  - 起きたら、開いている音楽サービスのタブに状態を聞き直してから判断します。続きに必要なもの（掲示中の status、消去用の署名済みイベントなど）は `chrome.storage.local` に保存しています。
- `MusicStatusController` は「いま掲示されているべき status」と「最後に送った status」を比較し、必要なときだけ送信します（`extension/src/core/music-status.ts`）。
  - 再生開始 / 曲の変更 / 一時停止からの再開 → publish
  - 一時停止 / タブを閉じた / 投稿をオフにした → clear（`content` を空にした kind:30315）
  - 再生位置が進んだだけ → 何もしない。seek やリピートで終了予想時刻が 10 秒以上ずれたときだけ再 publish
  - 曲送りの連打で途中の曲を投稿しないよう 1 秒 debounce し、送信は直列に行います
- `expiration`（NIP-40）は `観測時刻 + (duration - position)` で、曲が終わる予想時刻です。ブラウザごと閉じたなど消せなかった場合も、この時刻を過ぎると表示されなくなります。
- **消去**: publish のたびに、それより新しい `created_at` の消去イベントに前もって署名しておきます。タブを閉じたあとはもう署名できないためです。一時停止のときもこれを使うので、署名の確認は曲ごとの2回だけです。ブラウザを閉じて消せなかったときは、次にブラウザを起動したときに送ります。
- 投稿先は NIP-65 relay list（`kind:10002`）の write relay です。見つからなければ fallback relay（既定: `wss://relay.damus.io`, `wss://nos.lol`, `wss://yabu.me`）を使います。

### 音楽サービスを追加する

1. `extension/content/sources/<service>.js` に `defineMusicSource({ source, read })` を書く（`read` は曲の URL など、共通処理で足りない部分だけを返す。型は `extension/content/types.d.ts` の `MusicSourceAdapter`）
2. `extension/manifest.json` の `host_permissions` と `content_scripts` に追加する（`content/main-world.js` の `matches` にも追加する）
3. `extension/src/core/playback.ts` の `MusicService` に追加する

## セキュリティ

- Nowstr は Nostr の秘密鍵を扱いません。署名は、音楽サービスのタブのページ側（MAIN world）で `window.nostr` に依頼します。このやり取りはそのページのスクリプトからも見えるため、service worker は返ってきたイベントの内容・公開鍵・署名を検証してから送信します。
- 一方で、NIP-07 拡張で音楽サービスのサイトに署名を許可すると、**そのサイトのスクリプトも同じ許可で署名を依頼できる**ようになります。許可は kind:30315 に限定し、「すべての kind を常に許可」にはしないでください。
- 拡張が通信するのは Nostr relay だけです。保存するのは公開される情報（公開鍵・relay・掲示した status・署名済みの消去イベント）と設定だけです。
- 案内ページは `public/_headers` の Content-Security-Policy で、自サイト以外からの読み込みと通信を禁止しています。

## 開発

```sh
vp install                        # 依存関係のインストール
vp run build:extension            # 拡張の service worker とポップアップをビルドする（extension/dist/）
vp run build:extension -- --watch # 変更を追いかける
vp dev                            # 案内ページの開発サーバー (http://127.0.0.1:5173/)
```

`chrome://extensions` の「パッケージ化されていない拡張機能を読み込む」で `extension/` フォルダを選ぶと、開発中の拡張を試せます。content script（`extension/content/`）はビルドせず、そのまま読み込みます。

ツールチェーンは [Vite+](https://viteplus.dev/) に統一しています。lint / format は Oxc（Oxlint / Oxfmt）、型チェックは Oxlint の type-aware 機能（tsgolint）、テストは Vitest を `vp` 経由で使います。

| 目的                                       | コマンド                 |
| ------------------------------------------ | ------------------------ |
| format + lint + 型チェック                 | `vp check`               |
| 自動修正込み                               | `vp check --fix`         |
| unit test                                  | `vp test`                |
| 拡張のビルド                               | `vp run build:extension` |
| 拡張の配布用 zip                           | `vp run pack:extension`  |
| 案内ページの production build              | `vp build`               |
| 案内ページを Cloudflare Workers にデプロイ | `vp run deploy`          |

### 拡張のリリース手順（メンテナー向け）

`extension/manifest.json` の `version` を上げてコミットし、同じ番号のタグを push すると、GitHub Actions（`.github/workflows/extension-release.yml`）が拡張をビルドし、zip を作って Release に添付します。

```sh
git tag extension-v0.3.0
git push origin extension-v0.3.0
```

案内ページには、ビルドしたコミットの `extension/manifest.json` の `version` が最新版として表示されます。

### 自分でホスティングする場合

案内ページは `dist/` をそのまま配信できます。`.env.example` を `.env.local` にコピーして、公開 URL（OGP 用）・ソースコードの URL・問い合わせ先を設定できます。拡張のポップアップの「使い方」「プライバシーポリシー」のリンク先（`extension/popup/popup.html`）も、自分のドメインに書き換えてください。

## ディレクトリ構成

```text
src/                案内ページ（Solid + UnoCSS の静的な1ページ, プライバシーポリシー）
extension/          ブラウザ拡張 Nowstr（Manifest V3）
  content/          content script（ビルドしない）
    sources/        音楽サービスごとの MusicSourceAdapter
  popup/            ポップアップの HTML / CSS
  src/              service worker とポップアップのスクリプト（TypeScript, extension/dist/ にビルド）
    core/           純粋ロジック（PlaybackState, NIP-38 event, expiration, 更新判定, NIP-65, NIP-19）と unit test
    nostr/          relay client（rx-nostr）, NostrSigner の型
    status/         MusicStatusController
```

## ライセンス

[MIT](./LICENSE)
