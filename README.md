# Nowstr

Spotify の楽曲をブラウザで再生し、**いまこのブラウザで再生している曲**を Nostr の music status（[NIP-38](https://github.com/nostr-protocol/nips/blob/master/38.md)）として自動で掲示する、小型の Web 音楽プレイヤーです。

- Spotify Web Playback SDK でブラウザ自身を Spotify Connect デバイスにする
- 曲の開始・変更・一時停止・再開に合わせて `kind:30315` / `d=music` の status を publish / clear
- [Document Picture-in-Picture](https://developer.chrome.com/docs/web-platform/document-picture-in-picture) による常駐ミニプレイヤー
- バックエンドなしの SPA（Cloudflare Workers の静的アセットとして配信）

## 必要環境

| 項目     | 要件                                                          |
| -------- | ------------------------------------------------------------- |
| ブラウザ | **デスクトップ版 Chromium 系（Chrome / Edge）推奨**           |
| Spotify  | **Spotify Premium アカウント必須**（Web Playback SDK の要件） |
| Nostr    | **NIP-07 対応のブラウザ拡張**（nos2x, Alby, nostr-keyx など） |
| 開発     | Node.js 24 系, [Vite+](https://viteplus.dev/) (`vp`), pnpm    |

- Nostr 未接続でも Spotify の再生はできます（status の投稿だけが無効になります）。
- Nowstr は Nostr の秘密鍵を一切扱いません。署名はすべて NIP-07 拡張に依頼します。
- Safari / Firefox / モバイルは対象外です。

### Document Picture-in-Picture のブラウザ制約

- Chrome / Edge 116 以降のデスクトップ版でのみ利用できます。非対応ブラウザではミニプレイヤーボタンが無効になり、通常の UI だけが使えます。
- PiP ウィンドウはユーザー操作（ボタンのクリック）からしか開けません。
- 元のタブを閉じると PiP ウィンドウも閉じます。
- Spotify Player は元のタブに 1 つだけあり、PiP には同じ状態を参照する UI だけを表示しています。

## Spotify Developer App の作成

1. Spotify Premium のアカウントで [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) にログインする
2. **Create app** を押し、以下を入力する
   - **App name**: 任意（例: `Nowstr`）
   - **App description**: 任意（認可画面に表示されます）
   - **Redirect URIs**: 使う環境の URI をすべて登録する（下記）
   - **Which API/SDKs are you planning to use?**: **Web API** と **Web Playback SDK** にチェック
3. 利用規約に同意して **Save**
4. 作成した App の **Settings** から **Client ID** をコピーする（Client Secret は使いません）

### Redirect URI

Nowstr のコールバックパスは `/callback` です。

| 環境                      | Redirect URI                              |
| ------------------------- | ----------------------------------------- |
| 開発 (`vp dev`)           | `http://127.0.0.1:5173/callback`          |
| プレビュー (`vp preview`) | `http://127.0.0.1:4173/callback`          |
| 本番 (Cloudflare Workers) | `https://<デプロイ先のドメイン>/callback` |

> [!IMPORTANT]
> Spotify は `localhost` を Redirect URI として許可しません。ループバック IP（`127.0.0.1`）を使うか HTTPS にする必要があります。
> そのため開発サーバーは `127.0.0.1:5173` で起動するようにしています。ブラウザでも `http://127.0.0.1:5173/` を開いてください。

### Development Mode の制限（2026 年時点）

作成した App は Development Mode で動作し、主に次の制限があります。個人利用であれば問題ありません。

- **App の所有者が Spotify Premium であること**が必要です。
- 利用できるユーザーは最大 5 人です。自分以外が使う場合は Dashboard の **User Management** に追加してください。
- `GET /me` から `product` が返らなくなったため、Premium かどうかは Web Playback SDK の `account_error` で判定しています。

## 環境変数

`.env.example` を `.env.local` にコピーして設定します。

```sh
cp .env.example .env.local
```

| 変数                        | 必須 | 説明                                                                             |
| --------------------------- | ---- | -------------------------------------------------------------------------------- |
| `VITE_SPOTIFY_CLIENT_ID`    | ✓    | Spotify Developer App の Client ID                                               |
| `VITE_SPOTIFY_REDIRECT_URI` |      | Redirect URI を固定したい場合のみ設定する（既定: `${location.origin}/callback`） |

Client ID は公開情報なので、ビルド成果物に埋め込まれても問題ありません（PKCE を使っているため Client Secret は不要です）。

## 開発

```sh
vp install        # 依存関係のインストール
vp dev            # 開発サーバー (http://127.0.0.1:5173/)
```

### コマンド一覧

ツールチェーンは [Vite+](https://viteplus.dev/) に統一しています。lint / format は Oxc（Oxlint / Oxfmt）、型チェックは Oxlint の type-aware 機能（tsgolint）、テストは Vitest を `vp` 経由で使います。ESLint / Prettier は使っていません。

| 目的                          | コマンド           |
| ----------------------------- | ------------------ |
| 開発サーバー                  | `vp dev`           |
| format + lint + 型チェック    | `vp check`         |
| 自動修正込み                  | `vp check --fix`   |
| format チェックのみ           | `vp fmt --check`   |
| format                        | `vp fmt`           |
| lint                          | `vp lint`          |
| 型チェック                    | `vp run typecheck` |
| unit test                     | `vp test`          |
| production build              | `vp build`         |
| build 結果のプレビュー        | `vp preview`       |
| Cloudflare Workers にデプロイ | `vp run deploy`    |

## Build とデプロイ

```sh
vp build          # dist/ に出力
```

Cloudflare Workers の静的アセット（[Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)）として配信します。設定は `wrangler.jsonc` にあり、SPA としてすべてのパスで `index.html` を返します。

```sh
pnpm exec wrangler login   # 初回のみ
vp run deploy              # vp build && wrangler deploy
```

ビルド時に `VITE_SPOTIFY_CLIENT_ID` が必要です。`.env.local`（または `.env.production.local`）に書くか、環境変数として渡してください。デプロイ後は、本番の URL の `/callback` を Spotify App の Redirect URI に追加してください。

## 仕組み

```text
Spotify Web Playback SDK
        ↓  (SDK の型は src/spotify/ の外に出さない)
Playback Store  (src/state/spotify.ts)
        ├──────────────────────┐
        ↓                      ↓
     Main UI          MusicStatusController (src/status/)
        ↓                      ↓
  PiP UI (src/pip/)     NostrSigner (NIP-07) + relay client (rx-nostr)
```

- **source of truth は Nowstr 自身の Web Playback SDK の `player_state_changed`** です。Spotify アカウント全体の再生状態（他デバイスや公式アプリ）はポーリングしません。
- `MusicStatusController` は「いま掲示されているべき status」と「最後に送った status」を比較し、必要なときだけ送信します（`src/core/music-status.ts`）。
  - 再生開始 / 曲の変更 / 一時停止からの再開 → publish
  - 一時停止 / 切断 / Spotify ログアウト / Nostr ログアウト → clear（`content` を空にした kind:30315）
  - 再生位置が進んだだけ → 何もしない。seek やリピートで終了予想時刻が 10 秒以上ずれたときだけ再 publish
  - 曲送りの連打で途中の曲を投稿しないよう 1 秒 debounce し、送信は直列に行います
- `expiration`（NIP-40）は `観測時刻 + (duration - position)` で、曲が終わる予想時刻です。ブラウザの強制終了やネットワーク断で clear できなくても、status はこの時刻に自然に消えます。
- 投稿先は NIP-65 relay list（`kind:10002`）の write relay です。見つからなければ設定画面の fallback relay（既定: `wss://relay.damus.io`, `wss://nos.lol`, `wss://yabu.me`）を使います。
- relay への送信失敗は toast とステータス表示で通知するだけで、再生には影響しません。
- NIP-07 拡張によっては `signEvent()` のたびに確認ダイアログが出ます。拡張側で Nowstr に対して kind:30315 の署名を常に許可しておくと快適です。

## ディレクトリ構成

```text
src/
  core/      純粋ロジック（PlaybackState, NIP-38 event, expiration, 更新判定, NIP-65）と unit test
  spotify/   OAuth PKCE, Web API クライアント, Web Playback SDK アダプタ
  nostr/     NostrSigner（NIP-07）, relay client（rx-nostr）
  status/    MusicStatusController
  state/     Solid の store（Spotify / Nostr / 設定 / toast）
  pip/       Document Picture-in-Picture
  ui/        コンポーネント（Ark UI + UnoCSS）
```

## 永続化

`localStorage` に以下を保存します。Nostr の秘密鍵は保存しません。

- `nowstr:spotify:token` — Spotify のアクセストークン / リフレッシュトークン
- `nowstr:settings` — 音量、status 投稿の ON/OFF、fallback relay、Nostr の自動再接続フラグ
