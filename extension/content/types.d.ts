// content script 間・service worker との間で受け渡す型。
// 再生状態は Nowstr 本体の src/core/playback.ts と同じ形（service worker はそちらの型を直接使う）。

type BridgeSource = "youtube-music" | "spotify" | "soundcloud";

type BridgeTrack = {
  source: BridgeSource;
  /** 曲の https の URL。曲の同一性の判定にも使う */
  uri: string;
  title: string;
  artists: string[];
  album: string;
  artworkUrl: string | null;
  durationMs: number;
  unlisted: boolean;
};

type BridgePlaybackState = {
  track: BridgeTrack | null;
  paused: boolean;
  positionMs: number;
  durationMs: number;
  updatedAt: number;
};

/** content script → service worker（"player" ポート） */
type BridgePlayerMessage =
  | { type: "playback"; state: BridgePlaybackState | null }
  | { type: "nip07-result"; id: string; result?: unknown; error?: string };

/** service worker → content script（"player" ポート） */
type BridgeWorkerMessage = {
  type: "nip07";
  id: string;
  method: "getPublicKey" | "signEvent";
  params?: unknown;
};

/** main-world.js が <html data-nowstr-media> に書く、再生中の media 要素の状態 */
type MediaSnapshot = { paused: boolean; positionMs: number; durationMs: number };

/** どのサービスでも共通処理が読める情報 */
type SourceBase = {
  metadata: MediaMetadata | null;
  media: MediaSnapshot | null;
  playbackState: MediaSessionPlaybackState;
};

/**
 * adapter が補う情報。uri 以外は省略すると SourceBase の値を使う。
 * artworkUrl は null を返すと「アートワークなし」になる。
 */
type SourceReading = {
  uri: string | null;
  title?: string;
  artists?: string[];
  album?: string;
  artworkUrl?: string | null;
  paused?: boolean;
  positionMs?: number;
  durationMs?: number;
  unlisted?: boolean;
};

/**
 * 音楽サービス1つぶんの読み取り方。sources/*.js で defineMusicSource() に渡す。
 * 対象サイトかどうかは manifest.json の content_scripts の matches で決める。
 */
type MusicSourceAdapter = {
  source: BridgeSource;
  /**
   * いま再生中の曲の、共通処理では分からない部分を返す。
   * 曲として扱わない状態（広告・曲がない・画面から読めない）なら null。
   * 1秒ごとと、media 要素のイベントのたびに呼ばれる。
   */
  read(base: SourceBase): SourceReading | null;
};

// 同じタブで古い content script が残っていたら止めるためのフック。
// 拡張の再読み込み・更新時、古いスクリプトは孤立したまま残り、新しいものが注入されるため。
interface Window {
  __nowstrSourceStop?: () => void;
}
