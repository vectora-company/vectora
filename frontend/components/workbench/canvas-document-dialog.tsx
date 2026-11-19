"use client";

import type { ReactNode } from "react";

import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResizableDialogContent } from "@/components/ui/resizable-dialog";

interface CanvasDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  titleClassName?: string;
  /** Escondido na dock: continua montado, então o editor e as edições vivem. */
  minimized?: boolean;
  onMinimize?: () => void;
  children: ReactNode;
}

/**
 * Janela de um documento do canvas: move pelo cabeçalho, redimensiona por
 * qualquer borda, maximiza e minimiza para a dock.
 */
export function CanvasDocumentDialog({
  open,
  onOpenChange,
  title,
  titleClassName,
  minimized = false,
  onMinimize,
  children,
}: CanvasDocumentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={!minimized}>
      <ResizableDialogContent
        storageKey="canvas-document"
        defaultWidth={1248}
        defaultHeight={832}
        minWidth={480}
        minHeight={320}
        maxWidth={1600}
        maxHeight={1200}
        className="gap-0 p-0"
        aria-describedby={undefined}
        minimized={minimized}
        onMinimize={onMinimize}
      >
        <DialogHeader className="shrink-0 border-b border-border/60 py-3 pr-36 pl-4">
          <DialogTitle className={titleClassName ?? "truncate text-sm"}>
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1">{children}</div>
      </ResizableDialogContent>
    </Dialog>
  );
}
