import { Show } from "solid-js";
import { playback, spotify } from "../state/spotify";
import { Artwork } from "./Artwork";
import { NostrStatusBadge } from "./NostrStatusBadge";
import { PlayerControls } from "./PlayerControls";
import { ProgressBar } from "./ProgressBar";

/** Document Picture-in-Picture に表示する小型プレイヤー */
export const MiniPlayer = () => {
  const track = () => playback()?.track ?? null;

  return (
    <div class="h-full flex select-none items-center gap-3 bg-bg p-3 text-fg">
      <Artwork
        src={track()?.artworkUrl}
        alt={track()?.album ?? ""}
        class="aspect-square h-full max-h-36"
      />
      <div class="min-w-0 flex flex-1 flex-col justify-center gap-1">
        <Show
          when={track()}
          fallback={
            <p class="truncate text-sm text-muted">
              {spotify.player === "ready" ? "再生していません" : "Spotify に接続していません"}
            </p>
          }
        >
          {(t) => (
            <>
              <p class="truncate text-sm font-semibold" title={t().title}>
                {t().title}
              </p>
              <p class="truncate text-xs text-muted" title={t().artists.join(", ")}>
                {t().artists.join(", ")}
              </p>
            </>
          )}
        </Show>
        <div class="flex items-center justify-between">
          <PlayerControls compact />
          <NostrStatusBadge compact />
        </div>
        <ProgressBar compact />
      </div>
    </div>
  );
};
