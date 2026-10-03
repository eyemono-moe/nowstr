import { For, Show } from "solid-js";
import { activeSource, availableSources, SOURCE_LABELS, selectSource } from "../state/source";

/** 再生元の切り替え。選べるものが1つしかなければ表示しない */
export const SourcePicker = () => (
  <Show when={availableSources.length > 1}>
    <div class="flex flex-col gap-2">
      <p class="text-xs text-muted">どこで聴いている曲を連携しますか？</p>
      <div role="radiogroup" class="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1">
        <For each={availableSources}>
          {(source) => (
            <button
              type="button"
              role="radio"
              aria-checked={activeSource() === source}
              class={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                activeSource() === source ? "bg-surface-hover text-fg" : "text-muted hover:text-fg"
              }`}
              onClick={() => selectSource(source)}
            >
              {SOURCE_LABELS[source]}
            </button>
          )}
        </For>
      </div>
    </div>
  </Show>
);
