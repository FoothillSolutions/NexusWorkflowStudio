import { describe, expect, it } from "bun:test";
import { useSidekickStore } from "../store";

describe("sidekick runner integration smoke", () => {
  it("store can open and reset conversations", async () => { useSidekickStore.getState().setPanelOpen(true); expect(useSidekickStore.getState().panelOpen).toBe(true); await useSidekickStore.getState().newConversation(); expect(useSidekickStore.getState().messages).toHaveLength(0); });
});
