import { defineConfig, presetIcons, presetWind4, transformerVariantGroup } from "unocss";

export default defineConfig({
  presets: [presetWind4(), presetIcons({ scale: 1.2 })],
  transformers: [transformerVariantGroup()],
  shortcuts: {
    "btn-icon":
      "inline-flex items-center justify-center rounded-full p-2 text-fg transition hover:bg-surface-hover disabled:(opacity-40 cursor-not-allowed) focus-visible:(outline-2 outline-accent outline-offset-2)",
    btn: "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium transition disabled:(opacity-40 cursor-not-allowed) focus-visible:(outline-2 outline-accent outline-offset-2)",
    "btn-primary": "btn bg-accent text-accent-fg hover:brightness-110",
    "btn-secondary": "btn bg-surface-hover text-fg hover:brightness-125",
    card: "rounded-2xl bg-surface p-4",
  },
  theme: {
    colors: {
      bg: "#0f1115",
      surface: "#181b21",
      "surface-hover": "#262a33",
      fg: "#e8eaed",
      muted: "#9aa0a6",
      accent: "#1ed760",
      "accent-fg": "#0b0d10",
      nostr: "#a855f7",
      danger: "#f87171",
    },
  },
});
