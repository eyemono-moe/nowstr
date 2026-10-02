import { createToaster } from "@ark-ui/solid/toast";
import { errorMessage } from "../lib/errors";

export const toaster = createToaster({ placement: "bottom-end", overlap: true, gap: 12, max: 4 });

export const notifyError = (error: unknown, title = "エラー"): void => {
  console.error(error);
  toaster.create({ type: "error", title, description: errorMessage(error), duration: 8_000 });
};

export const notifyInfo = (title: string, description?: string): void => {
  toaster.create({ type: "info", title, description, duration: 4_000 });
};
