import { For, Show } from "solid-js";
import { loadPlaylists, playPlaylist, spotify } from "../state/spotify";
import { Artwork } from "./Artwork";

export const PlaylistPicker = () => (
  <section class="card min-h-0 flex flex-col gap-3">
    <header class="flex items-center justify-between">
      <h2 class="font-semibold">プレイリスト</h2>
      <button
        type="button"
        class="btn-icon"
        aria-label="再読み込み"
        title="再読み込み"
        disabled={spotify.playlistsLoading}
        onClick={() => void loadPlaylists()}
      >
        <div class={`i-lucide-refresh-cw ${spotify.playlistsLoading ? "animate-spin" : ""}`} />
      </button>
    </header>
    <Show
      when={spotify.playlists}
      fallback={<p class="text-sm text-muted">{spotify.playlistsLoading ? "読み込み中…" : ""}</p>}
    >
      {(playlists) => (
        <Show
          when={playlists().length > 0}
          fallback={<p class="text-sm text-muted">プレイリストがありません。</p>}
        >
          <ul class="-mx-2 min-h-0 flex flex-col overflow-y-auto">
            <For each={playlists()}>
              {(playlist) => (
                <li>
                  <button
                    type="button"
                    class="w-full flex items-center gap-3 rounded-lg p-2 text-left transition hover:bg-surface-hover disabled:opacity-40"
                    disabled={spotify.player !== "ready"}
                    title={`${playlist.name} を再生`}
                    onClick={() => playPlaylist(playlist.uri)}
                  >
                    <Artwork src={playlist.imageUrl} alt="" class="h-12 w-12 rounded-md" />
                    <div class="min-w-0">
                      <p class="truncate text-sm font-medium">{playlist.name}</p>
                      <Show when={playlist.ownerName}>
                        <p class="truncate text-xs text-muted">{playlist.ownerName}</p>
                      </Show>
                    </div>
                  </button>
                </li>
              )}
            </For>
          </ul>
        </Show>
      )}
    </Show>
  </section>
);
