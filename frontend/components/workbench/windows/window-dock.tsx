"use client";

/**
 * WindowDock — barra inferior com tudo o que está minimizado: janelas
 * flutuantes de arquivo e documentos do canvas. Clicar restaura (e traz para
 * o topo); o X de um documento o fecha de vez. Fica oculta sem itens.
 */

import { FileText, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { useWindowsStore } from "@/lib/stores/windows-store";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { m } from "@/lib/paraglide/messages";

const ITEM_CLASS =
  "flex items-center gap-1.5 max-w-[180px] px-2 py-1 rounded text-xs hover:bg-muted/60";

export function WindowDock() {
  const uiMode = useSettingsStore((s) => s.uiMode);
  const minimizedWindows = useWindowsStore(
    useShallow((s) => s.windows.filter((w) => w.minimized)),
  );
  const minimizedDocuments = useWindowsStore(
    useShallow((s) =>
      s.canvasDocuments.filter((document) =>
        s.minimizedCanvasDocumentIds.includes(document.id),
      ),
    ),
  );
  const restoreWindow = useWindowsStore((s) => s.restore);
  const restoreDocument = useWindowsStore((s) => s.restoreCanvasDocument);
  const closeDocument = useWindowsStore((s) => s.closeCanvasDocumentModal);

  // Documentos só viram janela no modo assistente; nos demais não há o que restaurar.
  const documents = uiMode === "assistant" ? minimizedDocuments : [];
  if (minimizedWindows.length + documents.length === 0) return null;

  return (
    <div
      data-testid="window-dock"
      className="safe-area-bottom-dock fixed bottom-2 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-1 px-1.5 py-1 rounded-lg border border-border bg-card/95 shadow-xl backdrop-blur"
    >
      {minimizedWindows.map((win) => (
        <button
          key={win.id}
          data-testid={`dock-window-${win.id}`}
          onClick={() => restoreWindow(win.id)}
          className={ITEM_CLASS}
          title={m.window_restore()}
        >
          <FileText className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{win.title}</span>
        </button>
      ))}
      {documents.map((document) => (
        <div
          key={document.id}
          data-testid={`dock-document-${document.id}`}
          className="flex items-center rounded hover:bg-muted/60"
        >
          <button
            onClick={() => restoreDocument(document.id)}
            className={ITEM_CLASS}
            title={m.window_restore()}
          >
            <FileText className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{document.title}</span>
          </button>
          <button
            onClick={() => closeDocument(document.id)}
            className="mr-1 rounded p-0.5 text-muted-foreground hover:text-destructive"
            aria-label={m.window_close()}
            title={m.window_close()}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
