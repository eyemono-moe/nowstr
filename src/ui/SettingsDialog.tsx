import { Dialog } from "@ark-ui/solid/dialog";
import { Switch } from "@ark-ui/solid/switch";
import { createSignal, For, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { normalizeRelayUrl } from "../core/relay-list";
import { nostr, refreshRelays, setClearOnClose } from "../state/nostr";
import { DEFAULT_FALLBACK_RELAYS, settings, updateSettings } from "../state/settings";
import { notifyInfo } from "../state/toast";
import { Diagnostics } from "./Diagnostics";

export const SettingsDialog = () => {
  const [relayText, setRelayText] = createSignal("");

  const saveRelays = () => {
    const relays = relayText()
      .split(/\s+/)
      .flatMap((line) => normalizeRelayUrl(line) ?? []);
    updateSettings({ fallbackRelays: relays.length > 0 ? relays : DEFAULT_FALLBACK_RELAYS });
    setRelayText(settings.fallbackRelays.join("\n"));
    void refreshRelays();
    notifyInfo("fallback relay を保存しました");
  };

  return (
    <Dialog.Root
      onOpenChange={({ open }) => open && setRelayText(settings.fallbackRelays.join("\n"))}
    >
      <Dialog.Trigger class="btn-icon" aria-label="設定" title="設定">
        <div class="i-lucide-settings" />
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content class="max-h-[90vh] overflow-y-auto max-w-lg w-full flex flex-col gap-5 rounded-2xl bg-surface p-6 text-fg shadow-2xl outline-none">
            <header class="flex items-center justify-between">
              <Dialog.Title class="text-lg font-semibold">設定</Dialog.Title>
              <Dialog.CloseTrigger class="btn-icon" aria-label="閉じる">
                <div class="i-lucide-x" />
              </Dialog.CloseTrigger>
            </header>

            <Switch.Root
              class="flex items-center justify-between gap-4"
              checked={settings.statusEnabled}
              onCheckedChange={({ checked }) => updateSettings({ statusEnabled: checked })}
            >
              <div>
                <Switch.Label class="font-medium">music status を投稿する</Switch.Label>
                <p class="text-xs text-muted">
                  NIP-38 (kind:30315, d=music) として再生中の曲を掲示します。
                </p>
              </div>
              <Switch.Control class="h-6 w-11 shrink-0 rounded-full bg-surface-hover p-0.5 transition data-[state=checked]:bg-accent">
                <Switch.Thumb class="block h-5 w-5 rounded-full bg-fg transition data-[state=checked]:translate-x-5" />
              </Switch.Control>
              <Switch.HiddenInput />
            </Switch.Root>

            <Switch.Root
              class="flex items-center justify-between gap-4"
              checked={settings.clearOnClose}
              disabled={!settings.statusEnabled}
              onCheckedChange={({ checked }) => setClearOnClose(checked)}
            >
              <div>
                <Switch.Label class="font-medium">タブを閉じたときにステータスを消す</Switch.Label>
                <p class="text-xs text-muted">
                  曲ごとに、消去用のイベントにも前もって署名しておきます（署名のたびに確認が出る拡張では、確認が1曲につき2回になります）。オンにした設定は次の曲から有効になります。
                </p>
              </div>
              <Switch.Control class="h-6 w-11 shrink-0 rounded-full bg-surface-hover p-0.5 transition data-[state=checked]:bg-accent data-[disabled]:opacity-40">
                <Switch.Thumb class="block h-5 w-5 rounded-full bg-fg transition data-[state=checked]:translate-x-5" />
              </Switch.Control>
              <Switch.HiddenInput />
            </Switch.Root>

            <Switch.Root
              class="flex items-center justify-between gap-4"
              checked={settings.confirmBeforeClose}
              onCheckedChange={({ checked }) => updateSettings({ confirmBeforeClose: checked })}
            >
              <div>
                <Switch.Label class="font-medium">再生中はタブを閉じる前に確認する</Switch.Label>
                <p class="text-xs text-muted">
                  曲の再生中に Nowstr
                  のタブを閉じようとすると、ブラウザの確認ダイアログを表示します。
                </p>
              </div>
              <Switch.Control class="h-6 w-11 shrink-0 rounded-full bg-surface-hover p-0.5 transition data-[state=checked]:bg-accent">
                <Switch.Thumb class="block h-5 w-5 rounded-full bg-fg transition data-[state=checked]:translate-x-5" />
              </Switch.Control>
              <Switch.HiddenInput />
            </Switch.Root>

            <div class="flex flex-col gap-2">
              <p class="font-medium">投稿先 relay</p>
              <Show
                when={nostr.pubkey}
                fallback={<p class="text-xs text-muted">Nostr にログインすると表示されます。</p>}
              >
                <p class="text-xs text-muted">
                  {nostr.relaySource === "nip65"
                    ? "NIP-65 relay list (kind:10002) の write relay を使用しています。"
                    : "relay list が見つからないため fallback relay を使用しています。"}
                </p>
                <ul class="flex flex-col gap-1 text-xs font-mono">
                  <For each={nostr.relays}>{(relay) => <li class="truncate">{relay}</li>}</For>
                </ul>
              </Show>
            </div>

            <div class="flex flex-col gap-2">
              <label for="fallback-relays" class="font-medium">
                fallback relay
              </label>
              <p class="text-xs text-muted">
                relay list が取得できない場合に使います。1行に1つ入力してください。
              </p>
              <textarea
                id="fallback-relays"
                class="min-h-24 rounded-lg bg-bg p-3 text-sm font-mono outline-none focus:(ring-2 ring-accent)"
                value={relayText()}
                onInput={(e) => setRelayText(e.currentTarget.value)}
              />
              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  class="btn-secondary text-sm"
                  onClick={() => setRelayText(DEFAULT_FALLBACK_RELAYS.join("\n"))}
                >
                  初期値に戻す
                </button>
                <button type="button" class="btn-primary text-sm" onClick={saveRelays}>
                  保存
                </button>
              </div>
            </div>

            <Diagnostics />
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
