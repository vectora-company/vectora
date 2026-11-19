import type { ContextMenuItem } from "@/components/workbench/git/git-context-menu";

/** Se o app roda no Electron, que desenha o menu de clique direito nativo. */
export function hasNativeContextMenu(): boolean {
  return typeof window !== "undefined" && Boolean(window.vectora?.contextMenu);
}

/**
 * Mostra os itens no menu nativo do Electron e executa o escolhido. Devolve
 * `false` sem fazer nada quando não há menu nativo (navegador comum).
 */
export async function popupNativeContextMenu(
  items: ContextMenuItem[],
): Promise<boolean> {
  const bridge = window.vectora?.contextMenu;
  if (!bridge || items.length === 0) return false;
  const picked = await bridge.popup(
    items.map((item, index) => ({ id: String(index), label: item.label })),
  );
  if (picked !== null) items[Number(picked)]?.onSelect();
  return true;
}
