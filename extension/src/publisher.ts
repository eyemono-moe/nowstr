import type { PublisherConfig, PublisherInfo } from "./protocol";
import type { MusicStatus } from "./core/music-status";
import type { EventTemplate } from "./core/nip38";
import type { PlaybackState } from "./core/playback";
import { DEFAULT_FALLBACK_RELAYS, normalizeRelayUrl, RELAY_LIST_INDEXERS } from "./core/relay-list";
import { AppError, errorMessage } from "./lib/errors";
import { assertPublished, NostrRelayClient } from "./nostr/relay-client";
import type { SignedEvent } from "./nostr/signer";
import { MusicStatusController, type StatusSnapshot } from "./status/music-status-controller";
import { type TabSigner, verifySignedEvent } from "./tab-signer";

/**
 * service worker は止まって作り直されることがあるため、続きから動くのに必要なものはすべて保存する。
 * 秘密鍵は扱わない（署名はタブの NIP-07 拡張に頼む）。保存するのは公開される情報だけ。
 */
type Stored = {
  config: PublisherConfig;
  pubkey: string | null;
  relays: string[];
  relaySource: "nip65" | "fallback" | null;
  /** relay list を最後に調べた時刻（Unix ミリ秒） */
  relaysCheckedAt: number;
  /** 最後に掲示した（しようとした）status */
  status: MusicStatus | null;
  lastCreatedAt: number;
  /** 掲示中の status を消すための、署名済みの消去イベント（タブが閉じられたときに使う） */
  armedClear: SignedEvent | null;
};

const STORAGE_KEY = "publisher";
const RELAY_REFRESH_MS = 24 * 60 * 60 * 1000;

const defaults: Stored = {
  config: { enabled: false, fallbackRelays: DEFAULT_FALLBACK_RELAYS, clearOnClose: true },
  pubkey: null,
  relays: [],
  relaySource: null,
  relaysCheckedAt: 0,
  status: null,
  lastCreatedAt: 0,
  armedClear: null,
};

type Options = {
  /** 署名を頼むタブ。なければ null */
  signer: () => TabSigner | null;
  /** 状態が変わったらポップアップとアイコンのバッジに知らせる */
  onInfo: (info: PublisherInfo) => void;
};

/**
 * NIP-38 music status を投稿する部分。
 *
 * いつ publish / clear するかは MusicStatusController に任せ、ここでは
 * 「どこで署名するか（音楽サービスのタブ）」「どこへ送るか（relay）」と、service worker の再起動に備えた保存だけを行う。
 */
export class ExtensionPublisher {
  private readonly stored: Stored;
  private readonly options: Options;
  private readonly controller: MusicStatusController;
  private client: NostrRelayClient | null = null;
  private snapshot: StatusSnapshot;

  static async load(options: Options): Promise<ExtensionPublisher> {
    const saved = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] as
      | Partial<Stored>
      | undefined;
    return new ExtensionPublisher({ ...defaults, ...saved }, options);
  }

  private constructor(stored: Stored, options: Options) {
    this.stored = stored;
    this.options = options;
    this.snapshot = {
      phase: stored.status ? "published" : "idle",
      status: stored.status,
      error: null,
    };
    this.controller = new MusicStatusController({
      send: (event) => this.send(event),
      prepareUnloadClear: (event) => this.armClear(event),
      onChange: (snapshot) => {
        this.snapshot = snapshot;
        if (snapshot.phase !== "sending") {
          this.save({ status: snapshot.status, lastCreatedAt: this.controller.createdAtCursor });
        }
        if (snapshot.phase === "error") console.warn("[Nowstr]", snapshot.error);
        this.notify();
      },
      restore: { status: stored.status, lastCreatedAt: stored.lastCreatedAt },
    });
  }

  get enabled(): boolean {
    return this.stored.config.enabled;
  }

  /** 各タブの再生状態をまとめたもの。投稿がオフなら掲示中の status を消す */
  update(state: PlaybackState | null): void {
    this.controller.update(this.stored.config.enabled ? state : null);
  }

  async configure(config: PublisherConfig, state: PlaybackState | null): Promise<void> {
    const prev = this.stored.config;
    const fallbackRelays = config.fallbackRelays.flatMap((url) => normalizeRelayUrl(url) ?? []);
    const next = {
      ...config,
      fallbackRelays: fallbackRelays.length > 0 ? fallbackRelays : DEFAULT_FALLBACK_RELAYS,
    };
    if (prev.enabled && !next.enabled) {
      // オフにしたら、掲示中の status を消してから止める
      await this.controller.clearNow().catch(() => {});
    }
    this.save({
      config: next,
      // オンにし直したときは公開鍵を取り直す（NIP-07 拡張でアカウントを切り替えた場合のため）
      ...(!prev.enabled && next.enabled ? { pubkey: null } : {}),
      ...(JSON.stringify(prev.fallbackRelays) !== JSON.stringify(next.fallbackRelays)
        ? { relaysCheckedAt: 0 }
        : {}),
      ...(next.clearOnClose ? {} : { armedClear: null }),
    });
    this.notify();
    if (next.enabled) {
      // 公開鍵と relay を先に取っておく（失敗しても、次の投稿のときにもう一度試す）
      try {
        await this.prepare();
        this.snapshot = { ...this.snapshot, error: null };
      } catch (error) {
        this.snapshot = { ...this.snapshot, error };
      }
      this.notify();
    }
    this.update(state);
  }

  info(): PublisherInfo {
    const { config, pubkey, relays, relaySource } = this.stored;
    const { phase, status, error } = this.snapshot;
    return {
      config,
      pubkey,
      relays,
      relaySource,
      phase,
      content: status?.content ?? null,
      error: error ? errorMessage(error) : null,
    };
  }

  private notify(): void {
    this.options.onInfo(this.info());
  }

  private save(patch: Partial<Stored>): void {
    Object.assign(this.stored, patch);
    chrome.storage.local.set({ [STORAGE_KEY]: this.stored }).catch((error) => {
      console.warn("[Nowstr] failed to save the publisher state", error);
    });
  }

  private requireSigner(): TabSigner {
    const signer = this.options.signer();
    if (!signer) {
      throw new AppError(
        "nip07_unavailable",
        "署名に使える音楽サービスのタブがありません（YouTube Music などのタブを開いてください）。",
      );
    }
    return signer;
  }

  /** 公開鍵と投稿先 relay を用意する */
  private async prepare(): Promise<{ pubkey: string; relays: string[] }> {
    let { pubkey } = this.stored;
    if (!pubkey) {
      pubkey = await this.requireSigner().getPublicKey();
      this.save({ pubkey, relaysCheckedAt: 0 });
    }
    if (
      this.stored.relays.length === 0 ||
      Date.now() - this.stored.relaysCheckedAt > RELAY_REFRESH_MS
    ) {
      const fallback = this.stored.config.fallbackRelays;
      const lookup = [...new Set([...fallback, ...RELAY_LIST_INDEXERS])];
      const writeRelays = await this.relayClient().fetchWriteRelays(pubkey, lookup);
      this.save(
        writeRelays
          ? { relays: writeRelays, relaySource: "nip65", relaysCheckedAt: Date.now() }
          : { relays: fallback, relaySource: "fallback", relaysCheckedAt: Date.now() },
      );
    }
    return { pubkey, relays: this.stored.relays };
  }

  private relayClient(): NostrRelayClient {
    this.client ??= new NostrRelayClient();
    return this.client;
  }

  private async send(template: EventTemplate): Promise<void> {
    const clearing = template.content === "";
    const { armedClear } = this.stored;
    if (clearing && armedClear) {
      // 用意してある消去イベントを使えば、タブが閉じていても、署名の確認を待たずに消せる。
      // 直前の publish より新しい created_at で署名してあるので、こちらで十分。
      this.save({ armedClear: null });
      assertPublished(await this.relayClient().publish(armedClear, this.stored.relays));
      return;
    }
    if (clearing && !this.options.signer() && this.expired()) {
      // 署名できるタブがなくても、掲示していた status はもう expiration で消えている
      return;
    }
    const signer = this.requireSigner();
    const { pubkey, relays } = await this.prepare();
    const event = await verifySignedEvent(await signer.signEvent(template), template, pubkey);
    assertPublished(await this.relayClient().publish(event, relays));
  }

  private expired(): boolean {
    const { status } = this.stored;
    return !status || status.expiresAt * 1000 <= Date.now();
  }

  private async armClear(template: EventTemplate | null): Promise<void> {
    if (!template || !this.stored.config.clearOnClose) {
      this.save({ armedClear: null });
      return;
    }
    const signer = this.requireSigner();
    const pubkey = this.stored.pubkey;
    if (!pubkey) throw new AppError("nip07_unavailable", "Nostr の公開鍵が分かりません。");
    // 失敗したら、古い消去イベント（いまの status より古い）は使えないので捨てる
    this.save({ armedClear: null });
    const event = await verifySignedEvent(await signer.signEvent(template), template, pubkey);
    this.save({ armedClear: event, lastCreatedAt: this.controller.createdAtCursor });
  }
}
