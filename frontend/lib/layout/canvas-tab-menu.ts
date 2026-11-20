import type { CenterCanvasTab } from "@/components/layout/center-canvas";
import type { ContextMenuItem } from "@/components/workbench/git/git-context-menu";
import { m } from "@/lib/paraglide/messages";

interface CanvasTabMenuActions {
  close: (id: string) => void;
  /** Abre um arquivo numa janela flutuante do workspace. */
  openInWindow: (workspaceId: string, path: string) => void;
  copyText: (text: string) => void;
}

/**
 * Itens do clique direito numa aba do canvas: fechar (esta, as outras, as da
 * direita, todas) e, nos arquivos, copiar o caminho e abrir de outra forma
 * (janela flutuante). O que não se aplica à aba não aparece.
 */
export function buildCanvasTabMenu(
  tab: CenterCanvasTab,
  tabs: CenterCanvasTab[],
  index: number,
  actions: CanvasTabMenuActions,
): ContextMenuItem[] {
  const closeAll = (ids: string[]) => () => {
    for (const id of ids) actions.close(id);
  };
  const others = tabs.filter((_, position) => position !== index);
  const right = tabs.slice(index + 1);
  const items: ContextMenuItem[] = [
    { label: m.canvas_tab_close(), onSelect: () => actions.close(tab.id) },
  ];
  if (others.length > 0) {
    items.push({
      label: m.canvas_tab_close_others(),
      onSelect: closeAll(others.map((other) => other.id)),
    });
  }
  if (right.length > 0) {
    items.push({
      label: m.canvas_tab_close_right(),
      onSelect: closeAll(right.map((other) => other.id)),
    });
  }
  if (tabs.length > 1) {
    items.push({
      label: m.canvas_tab_close_all(),
      onSelect: closeAll(tabs.map((other) => other.id)),
    });
  }
  const document = tab.document;
  if (document?.kind === "file" && document.path) {
    const path: string = document.path;
    const workspaceId = document.workspaceId;
    items.push({
      label: m.canvas_tab_copy_path(),
      onSelect: () => actions.copyText(path),
    });
    if (workspaceId) {
      items.push({
        label: m.canvas_tab_open_window(),
        onSelect: () => {
          actions.openInWindow(workspaceId, path);
          actions.close(tab.id);
        },
      });
    }
  }
  return items;
}
