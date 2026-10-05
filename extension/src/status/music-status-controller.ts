import {
  decideStatusAction,
  desiredMusicStatus,
  type MusicStatus,
  type StatusAction,
} from "../core/music-status";
import {
  buildClearMusicStatusEvent,
  buildMusicStatusEvent,
  type EventTemplate,
} from "../core/nip38";
import type { PlaybackState } from "../core/playback";

export type StatusPhase = "idle" | "sending" | "published" | "cleared" | "error";

export type StatusSnapshot = {
  phase: StatusPhase;
  /** 最後に publish した status（clear 済みなら null） */
  status: MusicStatus | null;
  error: unknown;
};

type Options = {
  /** 署名して relay に送る。失敗時は例外を投げる */
  send: (event: EventTemplate) => Promise<void>;
  onChange: (snapshot: StatusSnapshot) => void;
  /** 曲送りを連打したときに途中の曲を投稿しないための待ち時間 */
  debounceMs?: number;
  /**
   * タブを閉じたときに送る消去イベントを用意する（null は「用意していたものを破棄」）。
   * タブを閉じる瞬間には署名を待てないため、publish のたびに事前に署名しておく必要がある。
   * 失敗しても status の送信は止めない。
   */
  prepareUnloadClear?: (event: EventTemplate | null) => Promise<void>;
  /**
   * 前回までに掲示した status から再開する。
   * 拡張の service worker のように、途中でプロセスが止まって作り直されることがある環境で使う。
   */
  restore?: { status: MusicStatus | null; lastCreatedAt: number };
};

/**
 * 再生状態の変化を受け取り、必要なときだけ NIP-38 music status を publish / clear する。
 * Spotify SDK や relay の詳細は知らない。送信は常に1件ずつ直列に行う。
 */
export class MusicStatusController {
  private published: MusicStatus | null = null;
  private latest: PlaybackState | null = null;
  private lastCreatedAt = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running: Promise<void> | null = null;
  private dirty = false;

  private readonly options: Options;

  constructor(options: Options) {
    this.options = options;
    this.published = options.restore?.status ?? null;
    this.lastCreatedAt = options.restore?.lastCreatedAt ?? 0;
  }

  /** 最後に使った（予約した）created_at。restore で引き継ぐために保存する */
  get createdAtCursor(): number {
    return this.lastCreatedAt;
  }

  update(state: PlaybackState | null): void {
    this.latest = state;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.reconcile(), this.options.debounceMs ?? 1_000);
  }

  /** logout / disconnect 時に、待たずに status を消す */
  async clearNow(): Promise<void> {
    clearTimeout(this.timer);
    this.latest = null;
    await this.reconcile();
  }

  private reconcile(): Promise<void> {
    if (this.running) {
      this.dirty = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.dirty = false;
        const action = decideStatusAction(this.published, desiredMusicStatus(this.latest));
        if (action.type !== "none") await this.apply(action);
      } while (this.dirty);
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** addressable event は created_at が新しい方が勝つため、同一秒の連続送信でも単調増加させる */
  private nextCreatedAt(): number {
    this.lastCreatedAt = Math.max(Math.floor(Date.now() / 1000), this.lastCreatedAt + 1);
    return this.lastCreatedAt;
  }

  private async apply(action: Exclude<StatusAction, { type: "none" }>): Promise<void> {
    const createdAt = this.nextCreatedAt();
    const next = action.type === "publish" ? action.status : null;
    const event =
      action.type === "publish"
        ? buildMusicStatusEvent(action.status, createdAt)
        : buildClearMusicStatusEvent(createdAt);

    this.options.onChange({ phase: "sending", status: this.published, error: null });
    let sent = false;
    try {
      await this.options.send(event);
      sent = true;
      this.options.onChange({
        phase: next ? "published" : "cleared",
        status: next,
        error: null,
      });
    } catch (error) {
      this.options.onChange({ phase: "error", status: next, error });
    }
    await this.prepareUnloadClear(sent && next !== null);
    // 失敗しても「送ろうとした状態」を記録し、署名ダイアログ等の再送ループを避ける。
    // 次に曲や再生状態が変われば改めて送信される。
    this.published = next;
  }

  private async prepareUnloadClear(published: boolean): Promise<void> {
    if (!this.options.prepareUnloadClear) return;
    // 消去イベントは直前の publish より新しくないと効かないので、created_at を予約しておく
    const event = published ? buildClearMusicStatusEvent(this.nextCreatedAt()) : null;
    try {
      await this.options.prepareUnloadClear(event);
    } catch (error) {
      console.warn("Failed to prepare the status clear event for page unload", error);
    }
  }
}
