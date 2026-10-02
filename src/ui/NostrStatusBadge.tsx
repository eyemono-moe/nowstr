import { nostr } from "../state/nostr";
import { settings } from "../state/settings";

type Badge = { label: string; color: string; title: string };

/** Nostr music status の送信状態を小さく表示する */
export const NostrStatusBadge = (props: { compact?: boolean }) => {
  const badge = (): Badge => {
    if (nostr.nip07Available === false && !nostr.pubkey) {
      return { label: "NIP-07 なし", color: "bg-muted", title: "NIP-07 拡張が見つかりません" };
    }
    if (!nostr.pubkey) {
      return { label: "未接続", color: "bg-muted", title: "Nostr に接続していません" };
    }
    if (!settings.statusEnabled) {
      return { label: "投稿オフ", color: "bg-muted", title: "music status の投稿は無効です" };
    }
    switch (nostr.status.phase) {
      case "sending":
        return { label: "Sending", color: "bg-yellow-400 animate-pulse", title: "送信中" };
      case "published":
        return {
          label: "Published",
          color: "bg-accent",
          title: `掲示中: ${nostr.status.status?.content ?? ""}`,
        };
      case "cleared":
        return { label: "Cleared", color: "bg-muted", title: "status を消去しました" };
      case "error":
        return { label: "Error", color: "bg-danger", title: "送信に失敗しました" };
      default:
        return { label: "Ready", color: "bg-nostr", title: "再生すると status を投稿します" };
    }
  };

  return (
    <div
      class={`inline-flex items-center gap-1.5 text-muted ${props.compact ? "text-[10px]" : "text-xs"}`}
      title={badge().title}
    >
      <span class="i-lucide-zap text-nostr" />
      <span class={`h-2 w-2 rounded-full ${badge().color}`} />
      <span>{badge().label}</span>
    </div>
  );
};
