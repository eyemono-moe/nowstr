# Nowstr

ブラウザを Spotify の再生デバイスにして、**そのブラウザで再生している曲**を Nostr の music status（[NIP-38](https://github.com/nostr-protocol/nips/blob/master/38.md)）として自動で掲示する、ミニマルなウェブアプリです。

- Nowstr のタブを開いておくと、Spotify アプリのデバイス一覧に「Nowstr」が表示されます
- 再生操作・プレイリストの選択などは、いつもどおり **Spotify 公式アプリ**から行います
- Nowstr デバイスで再生した曲の開始・変更・一時停止・再開に合わせて、`kind:30315` / `d=music` の status を publish / clear します
- バックエンドなしの SPA です（Cloudflare Workers の静的アセットとして配信）

> [!IMPORTANT]
> Nowstr は **各自が自分の Spotify Developer App を作り、自分でホスティングして使う**ことを前提にしています。
> 理由は [Spotify の規約について](#spotify-の規約について) を参照してください。

## 必要環境

| 項目     | 要件                                                                          |
| -------- | ----------------------------------------------------------------------------- |
| ブラウザ | デスクトップ版 Chromium 系（Chrome / Edge）推奨                               |
| Spotify  | **Spotify Premium アカウント**（Web Playback SDK と Development Mode の要件） |
| Nostr    | **NIP-07 対応のブラウザ拡張**（nos2x, Alby, AKA Profiles など）               |
| 開発     | Node.js 24 系, [Vite+](https://viteplus.dev/) (`vp`), pnpm                    |

- Nostr 未接続でも Spotify の再生はできます（status の投稿だけが無効になります）。
- Nowstr は Nostr の秘密鍵を一切扱いません。署名はすべて NIP-07 拡張に依頼します。

## 使い方

1. Nowstr を開き、Spotify と Nostr（NIP-07）にログインする
2. 「このブラウザで再生」を押す（ブラウザの自動再生制限を解除するため、最初の1回はこのボタンが必要です）
3. あとは Spotify 公式アプリで普通に操作する。デバイスが「Nowstr」になっている間、再生中の曲が music status に掲示されます

Nowstr のタブを閉じる・他のデバイスに再生を移す・一時停止すると status は消えます。ブラウザの強制終了などで消せなかった場合も、曲の終了予定時刻（NIP-40 `expiration`）に自然に失効します。

### 常駐させるときのヒント

- NIP-07 拡張で、Nowstr に対する kind:30315 の署名を「常に許可」にしておくと、確認ダイアログで止まりません。
- Chrome のメモリセーバーで長時間一時停止したタブが破棄されることがあります。気になる場合は Nowstr のサイトを除外リストに追加してください。

## セルフホストの手順

### 1. Spotify Developer App を作る

1. Spotify Premium のアカウントで [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) にログインする
2. **Create app** を押し、以下を入力する
   - **App name**: 任意（`Spotify` を含めたり、紛らわしい名前にしないこと）
   - **App description**: 任意（認可画面に表示されます）
   - **Redirect URIs**: 使う環境の URI をすべて登録する（下表）
   - **Which API/SDKs are you planning to use?**: **Web API** と **Web Playback SDK**
3. 利用規約に同意して **Save** し、**Settings** から **Client ID** をコピーする（Client Secret は使いません）

Nowstr のコールバックパスは `/callback` です。

| 環境                      | Redirect URI                          |
| ------------------------- | ------------------------------------- |
| 開発 (`vp dev`)           | `https://127.0.0.1:5173/callback`     |
| プレビュー (`vp preview`) | `https://127.0.0.1:4173/callback`     |
| 本番                      | `https://<あなたのドメイン>/callback` |

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

`.env.example` を `.env.local` にコピーして設定します。

| 変数                        | 必須 | 説明                                                                              |
| --------------------------- | ---- | --------------------------------------------------------------------------------- |
| `VITE_SPOTIFY_CLIENT_ID`    | ✓    | 自分の Spotify Developer App の Client ID                                         |
| `VITE_SPOTIFY_REDIRECT_URI` |      | Redirect URI を固定したい場合のみ（既定: `${location.origin}/callback`）          |
| `VITE_SOURCE_URL`           |      | フッターに表示するソースコードの URL                                              |
| `VITE_CONTACT_URL`          |      | プライバシーポリシーに表示する問い合わせ先（URL / `mailto:`）。既定はソースの URL |

### 3. ビルド・デプロイする

Cloudflare Workers の静的アセット（[Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)）として配信する設定が `wrangler.jsonc` に入っています。`name` と `routes`（カスタムドメイン）は自分の環境に合わせて書き換えてください。`dist/` を配信できれば、他の静的ホスティングでも動きます（全パスで `index.html` を返す SPA 設定が必要です）。

```sh
vp install
pnpm exec wrangler login   # 初回のみ
vp run deploy              # vp build && wrangler deploy
```

デプロイ後、本番 URL の `/callback` を Spotify App の Redirect URI に追加してください。

## Spotify の規約について

Nowstr を公開・利用するうえで関係する [Spotify Developer Terms](https://developer.spotify.com/terms) / [Developer Policy](https://developer.spotify.com/policy) / [Design Guidelines](https://developer.spotify.com/documentation/design) の要点です（2026 年 10 月時点の確認。法的助言ではありません）。

- **Client ID はアプリごとに1つ、第三者に開示しない**（Developer Terms: Security Codes）
  1つの公開サイトに利用者が各自の Client ID を入力する方式は、この規定に反するため採用していません。各自が自分の App を作り、自分でホスティングしてください。
- **帰属表示とリンク**（Developer Policy II / Design Guidelines）
  曲のメタデータやアートワークを表示する箇所には、Spotify の公式ロゴ（`src/assets/spotify-full-logo-white.svg`、[公式配布物](https://developer.spotify.com/documentation/design)）と Spotify へのリンク（OPEN SPOTIFY）を表示しています。アートワークは加工・トリミングしません。Nowstr 自身のロゴや配色は Spotify のブランド要素（Spotify Green など）と紛らわしくならないようにしています。
- **プライバシーポリシーと連携解除手段**（Developer Policy I）
  `/privacy` にプライバシーポリシーを用意し、フッターから Spotify 連携の解除方法へリンクしています。
- **非商用・個人利用**
  Developer Terms のライセンスは private personal use の範囲です。広告・課金などの商用利用はできません。
- **他サービスへのデータ送信（グレーゾーン）**
  Developer Policy III は「ユーザー自身の個人データの移行」を除き、他サービスへのデータ転送を可能にするアプリを禁止しています。Nowstr は「ユーザー本人が、自分の再生状況を、自分の意思で Nostr に掲示する」ものですが、送信内容には Spotify のメタデータ（曲名・アーティスト名）が含まれます。Spotify がこれをどう解釈するかは明らかではなく、最悪の場合は自分の App（Client ID）が停止される可能性があることを理解したうえで使ってください。

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
  ui/        コンポーネント（Ark UI + UnoCSS）, プライバシーポリシー
```

## 永続化

`localStorage` に以下を保存します。Nostr の秘密鍵や再生履歴は保存しません。

- `nowstr:spotify:token` — Spotify のアクセストークン / リフレッシュトークン
- `nowstr:settings` — status 投稿の ON/OFF、fallback relay、Nostr の自動再接続フラグ
