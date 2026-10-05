import { describe, expect, it } from "vite-plus/test";
import { shortenNpub, toNpub } from "./npub";

describe("toNpub", () => {
  it("NIP-19 の例と一致する", () => {
    expect(toNpub("7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e")).toBe(
      "npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg",
    );
  });

  it("短縮表示", () => {
    expect(shortenNpub("npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg")).toBe(
      "npub10elfcs4…zvjptg",
    );
  });
});
