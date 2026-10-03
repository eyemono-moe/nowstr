import { Show } from "solid-js";
import spotifyLogo from "../assets/spotify-full-logo-white.svg";
import { spotifyWebUrl } from "../core/spotify-link";
import { activePlayback, activeSource } from "../state/source";
import { Artwork } from "./Artwork";
import { NostrStatusBadge } from "./NostrStatusBadge";

/**
 * 再生中の曲。
 * Spotify のメタデータを表示するときは、Spotify のロゴによる帰属表示と Spotify へのリンクを必ず添える
 * （Developer Policy / Design Guidelines）。YouTube Music は出典名と元の曲へのリンクを添える。
 */
export const NowPlaying = () => {
  const playback = activePlayback;
  const track = () => playback()?.track ?? null;
  const isSpotify = () => activeSource() === "spotify";

  return (
    <section class="card flex flex-col gap-4">
      <Show when={track()} fallback={<p class="text-sm text-muted">再生中の曲はありません</p>}>
        {(t) => {
          const url = () => (t().unlisted ? null : isSpotify() ? spotifyWebUrl(t().uri) : t().uri);
          return (
            <>
              <Show
                when={isSpotify()}
                fallback={
                  <p class="flex items-center gap-1.5 self-start text-sm font-semibold text-muted">
                    <span class="i-lucide-music" />
                    YouTube Music
                  </p>
                }
              >
                <img src={spotifyLogo} alt="Spotify" class="w-[84px] self-start" />
              </Show>
              <div class="flex items-center gap-4">
                <Artwork
                  src={t().artworkUrl}
                  alt={t().album}
                  class="aspect-square w-28 shrink-0 rounded-lg"
                />
                <div class="min-w-0 flex flex-col gap-0.5">
                  <Show when={url()} fallback={<p class="truncate font-semibold">{t().title}</p>}>
                    {(href) => (
                      <a
                        href={href()}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="truncate font-semibold hover:underline"
                        title={t().title}
                      >
                        {t().title}
                      </a>
                    )}
                  </Show>
                  <p class="truncate text-sm text-muted" title={t().artists.join(", ")}>
                    {t().artists.join(", ")}
                  </p>
                  <p class="truncate text-xs text-muted/70" title={t().album}>
                    {t().album}
                  </p>
                  <Show when={url()}>
                    {(href) => (
                      <a
                        href={href()}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="mt-2 self-start rounded-full border border-fg/30 px-3 py-1 text-[11px] font-bold tracking-wider hover:border-fg"
                      >
                        {isSpotify() ? "OPEN SPOTIFY" : "YouTube Music で開く"}
                      </a>
                    )}
                  </Show>
                </div>
              </div>
              <Show when={playback()?.paused}>
                <p class="text-xs text-muted">一時停止中</p>
              </Show>
            </>
          );
        }}
      </Show>
      <div class="border-t border-fg/10 pt-3">
        <NostrStatusBadge />
      </div>
    </section>
  );
};
