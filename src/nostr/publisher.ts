import { verifier } from "@rx-nostr/crypto";
import { createRxBackwardReq, createRxNostr, type RxNostr } from "rx-nostr";
import { takeUntil, timer } from "rxjs";
import { parseWriteRelays, RELAY_LIST_KIND } from "../core/relay-list";
import type { SignedEvent } from "./signer";

export type PublishResult = {
  /** OK を返した relay */
  accepted: string[];
  /** OK false（拒否）を返した relay と理由 */
  rejected: { relay: string; reason: string }[];
  /** 接続できない・応答がなかった relay */
  unreachable: string[];
};

const FETCH_TIMEOUT_MS = 8_000;

/**
 * relay との通信。署名は呼び出し側（NostrSigner）で済ませた event だけを受け取る。
 * 送信失敗は例外ではなく PublishResult で返し、呼び出し側の処理（再生など）を止めない。
 */
export class NostrRelayClient {
  private readonly rxNostr: RxNostr = createRxNostr({
    verifier,
    okTimeout: 10_000,
    eoseTimeout: 5_000,
  });

  /** NIP-65 の relay list (kind:10002) から write relay を取得する。見つからなければ null */
  fetchWriteRelays(pubkey: string, lookupRelays: string[]): Promise<string[] | null> {
    return new Promise((resolve) => {
      const req = createRxBackwardReq();
      let latest: { created_at: number; tags: string[][] } | null = null;
      this.rxNostr
        .use(req, { on: { relays: lookupRelays } })
        .pipe(takeUntil(timer(FETCH_TIMEOUT_MS)))
        .subscribe({
          next: ({ event }) => {
            if (!latest || event.created_at > latest.created_at) latest = event;
          },
          complete: () => {
            const relays = latest ? parseWriteRelays(latest.tags) : [];
            resolve(relays.length > 0 ? relays : null);
          },
          error: () => resolve(null),
        });
      req.emit({ kinds: [RELAY_LIST_KIND], authors: [pubkey], limit: 1 });
      req.over();
    });
  }

  publish(event: SignedEvent, relays: string[]): Promise<PublishResult> {
    return new Promise((resolve) => {
      const result: PublishResult = { accepted: [], rejected: [], unreachable: [] };
      const finish = () => {
        const responded = new Set([...result.accepted, ...result.rejected.map((r) => r.relay)]);
        result.unreachable = relays.filter((relay) => !responded.has(normalize(relay)));
        resolve(result);
      };
      this.rxNostr
        .send(event, { on: { relays }, completeOn: "all-ok", errorOnTimeout: false })
        .subscribe({
          next: ({ from, ok, notice }) => {
            if (ok) result.accepted.push(normalize(from));
            else result.rejected.push({ relay: normalize(from), reason: notice ?? "rejected" });
          },
          complete: finish,
          error: finish,
        });
    });
  }

  dispose(): void {
    this.rxNostr.dispose();
  }
}

const normalize = (url: string): string => {
  try {
    return new URL(url).toString();
  } catch {
    return url;
  }
};
