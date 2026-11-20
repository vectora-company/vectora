"use client";

import type { ReactNode } from "react";

import { CanvasDocumentDialog } from "@/components/workbench/canvas-document-dialog";
import type { CanvasDocumentDescriptor } from "@/lib/stores/windows-store";

interface CanvasDocumentWindowsProps {
  documents: CanvasDocumentDescriptor[];
  activeId: string | null;
  minimizedIds: string[];
  onClose: (id: string) => void;
  onMinimize: (id: string) => void;
  renderDocument: (document: CanvasDocumentDescriptor) => ReactNode;
}

/**
 * Uma janela por documento: a ativa aparece; as minimizadas ficam montadas
 * e escondidas (a dock as restaura), de modo que o editor de cada uma
 * mantém posição, seleção e edições não salvas.
 */
export function CanvasDocumentWindows({
  documents,
  activeId,
  minimizedIds,
  onClose,
  onMinimize,
  renderDocument,
}: CanvasDocumentWindowsProps) {
  const minimized = new Set(minimizedIds);
  const shown = documents.filter(
    (document) => minimized.has(document.id) || document.id === activeId,
  );
  return (
    <>
      {shown.map((document) => (
        <CanvasDocumentDialog
          key={document.id}
          open
          onOpenChange={(open) => {
            if (!open) onClose(document.id);
          }}
          title={document.title}
          titleClassName="truncate font-mono text-sm"
          minimized={minimized.has(document.id)}
          onMinimize={() => onMinimize(document.id)}
        >
          {renderDocument(document)}
        </CanvasDocumentDialog>
      ))}
    </>
  );
}
