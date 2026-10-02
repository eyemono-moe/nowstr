import { Slider } from "@ark-ui/solid/slider";
import { Show } from "solid-js";
import { settings } from "../state/settings";
import { setVolume, toggleMute } from "../state/spotify";

const volumeIcon = (volume: number) =>
  volume === 0 ? "i-lucide-volume-x" : volume < 0.5 ? "i-lucide-volume-1" : "i-lucide-volume-2";

/**
 * 音量。アイコンのクリックでミュート切り替え、ホイールで増減する。
 * 狭い場所では `showSlider={false}` にしてアイコンだけにできる。
 */
export const VolumeControl = (props: { showSlider?: boolean; sliderClass?: string }) => (
  <div
    class="flex items-center gap-1"
    title={`音量 ${Math.round(settings.volume * 100)}%（ホイールで調整）`}
    onWheel={(e) => {
      e.preventDefault();
      setVolume(settings.volume - Math.sign(e.deltaY) * 0.05);
    }}
  >
    <button
      type="button"
      class="btn-icon p-1 text-muted hover:text-fg"
      aria-label={settings.volume === 0 ? "ミュート解除" : "ミュート"}
      onClick={toggleMute}
    >
      <div class={volumeIcon(settings.volume)} />
    </button>
    <Show when={props.showSlider ?? true}>
      <Slider.Root
        class={props.sliderClass ?? "w-24"}
        min={0}
        max={1}
        step={0.01}
        value={[settings.volume]}
        aria-label={["音量"]}
        onValueChange={({ value }) => setVolume(value[0] ?? 0)}
      >
        <Slider.Control class="group relative flex h-4 items-center">
          <Slider.Track class="h-1 flex-1 overflow-hidden rounded-full bg-surface-hover">
            <Slider.Range class="h-full bg-muted group-hover:bg-accent" />
          </Slider.Track>
          <Slider.Thumb index={0} class="block h-3 w-3 rounded-full bg-fg outline-none">
            <Slider.HiddenInput />
          </Slider.Thumb>
        </Slider.Control>
      </Slider.Root>
    </Show>
  </div>
);
