import { Show } from "solid-js";

export const Artwork = (props: { src: string | null | undefined; alt: string; class?: string }) => (
  <div class={`shrink-0 overflow-hidden rounded-lg bg-surface-hover ${props.class ?? ""}`}>
    <Show
      when={props.src}
      fallback={
        <div class="h-full w-full flex items-center justify-center text-muted">
          <div class="i-lucide-music text-2xl" />
        </div>
      }
    >
      {(src) => <img src={src()} alt={props.alt} class="h-full w-full object-contain" />}
    </Show>
  </div>
);
