// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  hasNativeContextMenu,
  popupNativeContextMenu,
} from "../native-context-menu";

type Bridge = { contextMenu?: { popup: ReturnType<typeof vi.fn> } };

function setBridge(bridge: Bridge | undefined) {
  (window as unknown as { vectora?: Bridge }).vectora = bridge;
}

afterEach(() => setBridge(undefined));

describe("menu de clique direito nativo", () => {
  it("só existe dentro do Electron", () => {
    expect(hasNativeContextMenu()).toBe(false);
    setBridge({ contextMenu: { popup: vi.fn() } });
    expect(hasNativeContextMenu()).toBe(true);
  });

  it("sem menu nativo não faz nada e avisa quem chamou", async () => {
    expect(
      await popupNativeContextMenu([{ label: "A", onSelect: vi.fn() }]),
    ).toBe(false);
  });

  it("mostra os rótulos e executa só o item escolhido", async () => {
    const popup = vi.fn().mockResolvedValue("1");
    setBridge({ contextMenu: { popup } });
    const first = vi.fn();
    const second = vi.fn();

    const shown = await popupNativeContextMenu([
      { label: "Fechar", onSelect: first },
      { label: "Fechar as outras", onSelect: second },
    ]);

    expect(shown).toBe(true);
    expect(popup).toHaveBeenCalledWith([
      { id: "0", label: "Fechar" },
      { id: "1", label: "Fechar as outras" },
    ]);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it("fechar o menu sem escolher não executa nada", async () => {
    setBridge({ contextMenu: { popup: vi.fn().mockResolvedValue(null) } });
    const item = vi.fn();

    await popupNativeContextMenu([{ label: "A", onSelect: item }]);

    expect(item).not.toHaveBeenCalled();
  });

  it("id desconhecido devolvido pelo processo principal é ignorado", async () => {
    setBridge({ contextMenu: { popup: vi.fn().mockResolvedValue("9") } });
    const item = vi.fn();

    await popupNativeContextMenu([{ label: "A", onSelect: item }]);

    expect(item).not.toHaveBeenCalled();
  });
});
