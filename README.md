# Nowstr

YouTube Music または Spotify で再生中の曲を、Nostr のステータス（[NIP-38](https://github.com/nostr-protocol/nips/blob/master/38.md) の music status）として自動で設定する、1枚だけのウェブページです。

- **YouTube Music**: ブラウザ拡張「[Nowstr Bridge](#youtube-music-連携)」が、ブラウザで開いている YouTube Music のタブから再生中の曲を Nowstr に届けます
- **Spotify**: Nowstr のタブが Spotify アプリのデバイス一覧に「Nowstr」として表示されます。再生操作は、いつもどおり Spotify 公式アプリから行います
- 曲の開始・変更・一時停止・再開に合わせて、`kind:30315` / `d=music` の status を publish / clear します（`r` タグには、多くのクライアントがリンクとして表示できる `https://open.spotify.com/...` / `https://music.youtube.com/...` の URL を入れます）
- バックエンドなしの静的な1ページです（`dist/` をそのまま配信できます）
- Spotify の Client ID をビルド時に設定しなければ、Spotify の導線は表示されず YouTube Music 専用になります

> [!IMPORTANT]
> Spotify 連携を使う場合、Nowstr は **各自が自分の Spotify Developer App を作り、自分でホスティングして使う**ことを前提にしています。
> 理由は [Spotify の規約について](#spotify-の規約について) を参照してください。

## 必要環境

| 項目          | 要件                                                                          |
| ------------- | ----------------------------------------------------------------------------- |
| ブラウザ      | デスクトップ版 Chromium 系（Chrome / Edge）推奨                               |
| Spotify       | **Spotify Premium アカウント**（Web Playback SDK と Development Mode の要件） |
| YouTube Music | ブラウザ拡張 **Nowstr Bridge**（[YouTube Music 連携](#youtube-music-連携)）   |
| Nostr         | **NIP-07 対応のブラウザ拡張**（nos2x, Alby, AKA Profiles など）               |
| 開発          | Node.js 24 系, [Vite+](https://viteplus.dev/) (`vp`), pnpm                    |

- Nostr 未接続でも Spotify の再生はできます（status の投稿だけが無効になります）。
- Nowstr は Nostr の秘密鍵を一切扱いません。署名はすべて NIP-07 拡張に依頼します。

## 使い方

ページの「はじめかた」に沿って進めます。

1. **Spotify にログイン**
2. **Nostr にログイン**（NIP-07 拡張を使います）
3. **連携をはじめる** を押す — Spotify で再生中の曲が、このタブで流れはじめます

あとは Spotify 公式アプリで普通に操作するだけです。

- 連携中は、音が Nowstr のタブから流れます。曲の操作（再生・一時停止・曲送り・音量など）は Spotify アプリで行えます。
- このタブを開いている間、再生中の曲が Nostr のステータスに表示されます。一時停止するとステータスは消えます。
- タブを閉じたときも、ステータスの消去を試みます（下記）。ブラウザの強制終了やネットワーク断などで消せなかった場合も、曲の終了予定時刻（NIP-40 `expiration`）に自然に失効します。
- Spotify アプリで再生先を別の端末に切り替えると、連携は止まります。再開するときは、Spotify アプリの再生先の一覧から「Nowstr」を選ぶか、③ のボタンをもう一度押してください。

> [!NOTE]
> 仕組みとしては、Nowstr のタブが Spotify Connect の再生デバイス（Web Playback SDK）になり、③ のボタンで再生をそのデバイスへ移しています。
> ブラウザの自動再生制限を解除するため、ページを開くたびに最初の1回はタブ内でボタンを押す必要があります。

### 常駐させるときのヒント

- Nowstr のタブは開いたままにしておいてください（Spotify では音の再生も、どちらの場合もステータスの署名・投稿もこのタブで行います）。再生中にタブを閉じようとすると、ブラウザの確認ダイアログが表示されます（設定でオフにできます）。

- NIP-07 拡張で、Nowstr に対する kind:30315 の署名を「常に許可」にしておくと、確認ダイアログで止まりません。
- Chrome のメモリセーバーで長時間一時停止したタブが破棄されることがあります。気になる場合は Nowstr のサイトを除外リストに追加してください。

## YouTube Music 連携

YouTube Music には「いま再生中の曲」を取得できる公式 API がありません。そのため、ブラウザ拡張 **Nowstr Bridge**（`extension/`）が、ブラウザで開いている YouTube Music のタブの表示内容から再生中の曲を読み取り、Nowstr のタブへ渡します。署名と投稿はこれまでどおり Nowstr のタブで行います。

```text
[music.youtube.com のタブ]  extension/youtube-music.js
  navigator.mediaSession.metadata（曲名・アーティスト・アルバム・アートワーク）
  <video>（再生中か・再生位置・長さ）
  プレイヤーの getVideoData()（曲の ID。extension/youtube-music-main.js がページ側で読む）
  ※ ホーム・プレイリスト・ライブラリなど、どのページで再生していても取得できる
        ↓ chrome.runtime（extension/background.js が中継）
[Nowstr のタブ]  extension/bridge.js → window.postMessage
        ↓ src/youtube/extension-protocol.ts で検証
  MusicStatusController → NIP-07 で署名 → relay
```

### Nowstr Bridge のインストール

Chrome ウェブストアには未公開なので、配布している zip を「パッケージ化されていない拡張機能」として読み込みます。

1. [Releases](https://github.com/eyemono-moe/nowstr/releases/latest) から **nowstr-bridge.zip** をダウンロードして展開する（[直接ダウンロード](https://github.com/eyemono-moe/nowstr/releases/latest/download/nowstr-bridge.zip)）
2. Chrome で `chrome://extensions` を開き、右上の **デベロッパー モード** をオンにする
3. **パッケージ化されていない拡張機能を読み込む** から、展開したフォルダを選ぶ
4. Nowstr のページを開き、「はじめかた」で YouTube Music を選ぶ

- 展開したフォルダは削除しないでください（Chrome はそのフォルダから拡張を読み込み続けます）。
- 更新するときは、フォルダの中身を新しい zip の内容に置き換えて、`chrome://extensions` で拡張の再読み込みボタンを押してください。自動更新はされません。
- インストール・更新した時点で開いていた YouTube Music / Nowstr のタブには、拡張が自動でスクリプトを入れ直します。それでも連携されない場合は、両方のタブを再読み込みしてください。
- Vivaldi・Edge・Brave など他の Chromium 系ブラウザでも同じ手順で使えます。

#### 自分のドメインでホスティングする場合

配布している zip は `https://nowstr.eyemono.moe` と `127.0.0.1` / `localhost` でだけ動きます。自分のドメインで Nowstr をホスティングする場合は、`extension/manifest.json` の `host_permissions` と、`bridge.js` の `content_scripts` の `matches` にそのドメインを追加し、`extension/` フォルダを読み込んでください。

#### zip のリリース手順（メンテナー向け）

`extension/manifest.json` の `version` を上げてコミットし、同じ番号のタグを push すると、GitHub Actions（`.github/workflows/extension-release.yml`）が zip を作って Release に添付します。

```sh
git tag extension-v0.1.3
git push origin extension-v0.1.3
```

手元で zip だけ作る場合は `vp run pack:extension` を実行してください（`nowstr-bridge.zip` ができます）。

### 制約と注意

- うまく連携されないときは、設定画面の「診断情報」で状態を確認できます（コピーして不具合報告に添えられます）。

- 対象は、デスクトップブラウザで開いている YouTube Music（`music.youtube.com`）だけです。スマートフォンのアプリなどで再生している曲は取得できません。
- 広告の再生中（`.ad-showing`）は曲として扱いません。広告中は mediaSession に広告の情報が入るためです。
- MV など、アルバムがない曲はアルバム名が空になります。アートワークも動画のサムネイル（16:9）になることがあります。
- YouTube 公式の連携方法ではありません。ユーザーが自分で開いているページの表示内容を読むだけで、YouTube のサーバーへの自動アクセスは行いませんが、YouTube Music の画面構成が変わると動かなくなる可能性があります。

## セルフホストの手順

### 1. Spotify Developer App を作る

1. Spotify Premium のアカウントで [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) にログインする
2. **Create app** を押し、以下を入力する
   - **App name**: 任意（`Spotify` を含めたり、紛らわしい名前にしないこと）
   - **App description**: 任意（認可画面に表示されます）
   - **Redirect URIs**: 使う環境の URI をすべて登録する（下表）
   - **Which API/SDKs are you planning to use?**: **Web API** と **Web Playback SDK**
3. 利用規約に同意して **Save** し、**Settings** から **Client ID** をコピーする（Client Secret は使いません）

ログイン後はサイトのトップ（`/`）に戻ってきます。

| 環境                      | Redirect URI                  |
| ------------------------- | ----------------------------- |
| 開発 (`vp dev`)           | `https://127.0.0.1:5173/`     |
| プレビュー (`vp preview`) | `https://127.0.0.1:4173/`     |
| 本番                      | `https://<あなたのドメイン>/` |

> [!NOTE]
> 開発サーバーは **`https://127.0.0.1:5173/`**（自己署名証明書の HTTPS）で起動します。初回は証明書の警告が出るので、「詳細設定」から続行してください。
>
> - Spotify は `localhost` を Redirect URI として許可しません（ループバック IP の `127.0.0.1` か HTTPS が必要）。
> - NIP-07 拡張の中には `https://` と `http://localhost` でしか `window.nostr` を注入しないものがあります（例: AKA Profiles）。
>
> この両方を満たすため、`127.0.0.1` を HTTPS で配信しています（`@vitejs/plugin-basic-ssl`）。

#### Development Mode の制限（2026 年時点）

- **App の所有者が Spotify Premium であること**が必要です。
- ログインできるのは、Dashboard の **User Management** に登録した最大 5 人までです（家族や友人に使ってもらう場合は登録してください）。
- 制限の解除（Extended Quota Mode）は法人のみが申請でき、MAU 25 万人以上などの条件があります。

### 2. 環境変数を設定する

`.env.example` を `.env.local` にコピーして設定します。YouTube Music 連携だけを使う場合、設定は不要です（`VITE_SPOTIFY_CLIENT_ID` を空にすると Spotify の導線は表示されません）。

| 変数                        | 必須 | 説明                                                                                             |
| --------------------------- | ---- | ------------------------------------------------------------------------------------------------ |
| `VITE_SPOTIFY_CLIENT_ID`    |      | 自分の Spotify Developer App の Client ID（Spotify 連携に必須。空なら Spotify の導線を出さない） |
| `VITE_SPOTIFY_REDIRECT_URI` |      | Redirect URI を固定したい場合のみ（既定: `${location.origin}/`）                                 |
| `VITE_SOURCE_URL`           |      | フッターに表示するソースコードの URL                                                             |
| `VITE_CONTACT_URL`          |      | プライバシーポリシーに表示する問い合わせ先（URL / `mailto:`）。既定はソースの URL                |

### 3. ビルド・デプロイする

Cloudflare Workers の静的アセット（[Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)）として配信する設定が `wrangler.jsonc` に入っています。`name` と `routes`（カスタムドメイン）は自分の環境に合わせて書き換えてください。ページは1枚だけでルーティングもないので、`dist/` をそのまま置ける静的ホスティングならどこでも動きます。

```sh
vp install
pnpm exec wrangler login   # 初回のみ
vp run deploy              # vp build && wrangler deploy
```

デプロイ後、本番 URL（`https://<あなたのドメイン>/`）を Spotify App の Redirect URI に追加してください。

## Spotify の規約について

Nowstr を公開・利用するうえで関係する [Spotify Developer Terms](https://developer.spotify.com/terms) / [Developer Policy](https://developer.spotify.com/policy) / [Design Guidelines](https://developer.spotify.com/documentation/design) の要点です（2026 年 10 月時点の確認。法的助言ではありません）。

- **Client ID はアプリごとに1つ、第三者に開示しない**（Developer Terms: Security Codes）
  1つの公開サイトに利用者が各自の Client ID を入力する方式は、この規定に反するため採用していません。各自が自分の App を作り、自分でホスティングしてください。
- **帰属表示とリンク**（Developer Policy II / Design Guidelines）
  曲のメタデータやアートワークを表示する箇所には、Spotify の公式ロゴ（`src/assets/spotify-full-logo-white.svg`、[公式配布物](https://developer.spotify.com/documentation/design)）と Spotify へのリンク（OPEN SPOTIFY）を表示しています。アートワークは加工・トリミングしません。Nowstr 自身のロゴや配色は Spotify のブランド要素（Spotify Green など）と紛らわしくならないようにしています。
- **プライバシーポリシーと連携解除手段**（Developer Policy I）
  フッターからプライバシーポリシー（ダイアログ。`/#privacy` で直接開けます）と Spotify 連携の解除方法へリンクしています。
- **非商用・個人利用**
  Developer Terms のライセンスは private personal use の範囲です。広告・課金などの商用利用はできません。
- **他サービスへのデータ送信（グレーゾーン）**
  Developer Policy III は「ユーザー自身の個人データの移行」を除き、他サービスへのデータ転送を可能にするアプリを禁止しています。Nowstr は「ユーザー本人が、自分の再生状況を、自分の意思で Nostr に掲示する」ものですが、送信内容には Spotify のメタデータ（曲名・アーティスト名）が含まれます。Spotify がこれをどう解釈するかは明らかではなく、最悪の場合は自分の App（Client ID）が停止される可能性があることを理解したうえで使ってください。

## セキュリティ

- Spotify のトークンは `localStorage` に保存しています。バックエンドを持たない SPA ではどの保存先でも XSS に対する強さは変わらず、Web Playback SDK も JavaScript からアクセストークンを受け取るため、この方式を採っています。scope は最小限（SDK の要件 + `user-modify-playback-state`）です。
- 代わりに `public/_headers` で **Content-Security-Policy** を設定し、スクリプトの読み込み元を自サイトと `sdk.scdn.co` に、通信先を Spotify の API / 認可サーバーと Nostr relay（`wss:`）に制限しています。万一スクリプトが混入しても、任意のサーバーへトークンを送りにくくするためです。そのため rx-nostr の NIP-11 取得（relay ごとの `https:` 通信）は無効にしています。
- `_headers` は Cloudflare Workers / Pages と Netlify で使える形式です。他のホスティングで配信する場合は、同じヘッダーを設定してください。
- トークンを消すにはログアウトしてください。Spotify 側での取り消しは [アカウントページ](https://www.spotify.com/account/apps/) から行えます。

## 開発

```sh
vp install        # 依存関係のインストール
vp dev            # 開発サーバー (https://127.0.0.1:5173/)
```

ツールチェーンは [Vite+](https://viteplus.dev/) に統一しています。lint / format は Oxc（Oxlint / Oxfmt）、型チェックは Oxlint の type-aware 機能（tsgolint）、テストは Vitest を `vp` 経由で使います。ESLint / Prettier は使っていません。

| 目的                          | コマンド           |
| ----------------------------- | ------------------ |
| 開発サーバー (https)          | `vp dev`           |
| format + lint + 型チェック    | `vp check`         |
| 自動修正込み                  | `vp check --fix`   |
| format チェックのみ           | `vp fmt --check`   |
| lint                          | `vp lint`          |
| 型チェック                    | `vp run typecheck` |
| unit test                     | `vp test`          |
| production build              | `vp build`         |
| build 結果のプレビュー        | `vp preview`       |
| Cloudflare Workers にデプロイ | `vp run deploy`    |

## 仕組み

```text
Spotify Web Playback SDK（このタブ = Spotify Connect デバイス「Nowstr」）
        ↓  (SDK の型は src/spotify/ の外に出さない)
Playback Store  (src/state/spotify.ts)
        ├────────────────────┐
        ↓                    ↓
  Now playing 表示     MusicStatusController (src/status/)
                             ↓
                NostrSigner (NIP-07) + relay client (rx-nostr)
```

- **source of truth は Nowstr 自身の Web Playback SDK の `player_state_changed`** です。操作が Nowstr 以外（Spotify 公式アプリ）から行われても、Nowstr デバイスで再生している限り状態が通知されます。Spotify アカウント全体の再生状態はポーリングしません。
- `MusicStatusController` は「いま掲示されているべき status」と「最後に送った status」を比較し、必要なときだけ送信します（`src/core/music-status.ts`）。
  - 再生開始 / 曲の変更 / 一時停止からの再開 → publish
  - 一時停止 / 他デバイスへの移動 / 切断 / ログアウト → clear（`content` を空にした kind:30315）
  - 再生位置が進んだだけ → 何もしない。seek やリピートで終了予想時刻が 10 秒以上ずれたときだけ再 publish
  - 曲送りの連打で途中の曲を投稿しないよう 1 秒 debounce し、送信は直列に行います
- `expiration`（NIP-40）は `観測時刻 + (duration - position)` で、曲が終わる予想時刻です。
- **タブを閉じたときの消去**: ページが閉じられる瞬間（`pagehide`）は、NIP-07 の署名も relay への接続も待てません。そのため status を publish するたびに、それより新しい `created_at` の消去イベント（空の kind:30315）に前もって署名しておきます。あわせて送信先 relay への WebSocket を開いておき、`pagehide` で同期的に送ります。ブラウザが送信を終える前にプロセスを止めた場合は届かないので、あくまでベストエフォートです（設定でオフにできます）。
- 投稿先は NIP-65 relay list（`kind:10002`）の write relay です。見つからなければ設定画面の fallback relay（既定: `wss://relay.damus.io`, `wss://nos.lol`, `wss://yabu.me`）を使います。
- relay への送信失敗は toast とステータス表示で通知するだけで、再生には影響しません。

## ディレクトリ構成

```text
src/
  core/      純粋ロジック（PlaybackState, NIP-38 event, expiration, 更新判定, NIP-65, NIP-19）と unit test
  spotify/   OAuth PKCE, Web API クライアント, Web Playback SDK アダプタ
  nostr/     NostrSigner（NIP-07）, relay client（rx-nostr）
  status/    MusicStatusController
  state/     Solid の store（Spotify / Nostr / 設定 / toast）
  youtube/   ブラウザ拡張とのメッセージ形式と検証
  ui/        コンポーネント（Ark UI + UnoCSS）, プライバシーポリシー
extension/   ブラウザ拡張 Nowstr Bridge（YouTube Music の再生状態を Nowstr に渡す, Manifest V3）
```

## 永続化

`localStorage` に以下を保存します。Nostr の秘密鍵や再生履歴は保存しません。

- `nowstr:spotify:token` — Spotify のアクセストークン / リフレッシュトークン
- `nowstr:settings` — status 投稿の ON/OFF、fallback relay、Nostr の自動再接続フラグ

## ライセンス

[MIT](./LICENSE)

`src/assets/spotify-full-logo-white.svg` は Spotify の商標であり、MIT ライセンスの対象外です。[Spotify Design Guidelines](https://developer.spotify.com/documentation/design) に従った帰属表示のためにのみ使用しています。
