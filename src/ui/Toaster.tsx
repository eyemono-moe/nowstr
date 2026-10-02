import { Toast, Toaster as ArkToaster } from "@ark-ui/solid/toast";
import { toaster } from "../state/toast";

export const Toaster = () => (
  <ArkToaster toaster={toaster}>
    {(toast) => (
      <Toast.Root
        class={`relative w-80 rounded-xl border-l-4 bg-surface-hover p-4 pr-10 text-fg shadow-xl transition-all duration-300
          translate-x-[var(--x)] translate-y-[var(--y)] scale-[var(--scale)] opacity-[var(--opacity)] z-[var(--z-index)] h-[var(--height)]
          ${toast().type === "error" ? "border-danger" : "border-accent"}`}
      >
        <Toast.Title class="text-sm font-semibold">{toast().title}</Toast.Title>
        <Toast.Description class="mt-1 text-xs text-muted">{toast().description}</Toast.Description>
        <Toast.CloseTrigger class="btn-icon absolute right-2 top-2 p-1" aria-label="閉じる">
          <div class="i-lucide-x text-sm" />
        </Toast.CloseTrigger>
      </Toast.Root>
    )}
  </ArkToaster>
);
