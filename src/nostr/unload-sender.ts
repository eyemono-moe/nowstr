import type { SignedEvent } from "./signer";

const RECONNECT_DELAY_MS = 5_000;

/**
 * タブを閉じる瞬間（pagehide）に、署名済みイベントを relay へ送るための接続。
 *
 * ページ破棄中は Promise や新しい接続の確立を待てないため、
 * 事前に WebSocket を開いておき、閉じるときは同期的に `send()` するだけにする。
 * 送信が relay に届くかはブラウザ次第のベストエフォート（届かなくても expiration で消える）。
 */
export class UnloadSender {
  private readonly sockets = new Map<string, WebSocket>();
  private relays: string[] = [];
  private event: SignedEvent | null = null;

  /** 閉じるときに送るイベントを設定し、送信先 relay への接続を保つ。null で解除して切断する */
  arm(event: SignedEvent | null, relays: string[]): void {
    this.event = event;
    this.relays = event ? relays : [];
    for (const [url, socket] of this.sockets) {
      if (!this.relays.includes(url)) {
        this.sockets.delete(url);
        socket.close();
      }
    }
    for (const url of this.relays) this.connect(url);
  }

  /** pagehide から呼ぶ。開いている接続にだけ同期的に送る */
  flush(): number {
    if (!this.event) return 0;
    const message = JSON.stringify(["EVENT", this.event]);
    let count = 0;
    for (const socket of this.sockets.values()) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      socket.send(message);
      count++;
    }
    this.event = null;
    return count;
  }

  private connect(url: string): void {
    const existing = this.sockets.get(url);
    if (existing && existing.readyState <= WebSocket.OPEN) return;
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      return;
    }
    this.sockets.set(url, socket);
    // relay がアイドル接続を切ることがあるので、使う予定がある間は張り直す
    socket.addEventListener("close", () => {
      if (this.sockets.get(url) !== socket) return;
      this.sockets.delete(url);
      setTimeout(() => {
        if (this.event && this.relays.includes(url)) this.connect(url);
      }, RECONNECT_DELAY_MS);
    });
  }
}
