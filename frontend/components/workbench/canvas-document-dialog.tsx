"use client";

import { useState, type ReactNode } from "react";
import { Maximize2, X } from "lucide-react";

import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResizableDialogContent } from "@/components/ui/resizable-dialog";
import { m } from "@/lib/paraglide/messages";

interface CanvasDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  titleClassName?: string;
  children: ReactNode;
}

/**
 * Janela única para documentos abertos a partir do canvas compartilhado:
 * move pelo cabeçalho, redimensiona por qualquer borda, maximiza e minimiza.
 * Minimizada, a janela some mas continua montada (o editor e as edições não
 * se perdem) e vira um botão no canto da tela para restaurar.
 */
export function CanvasDocumentDialog({
  open,
  onOpenChange,
  title,
  titleClassName,
  children,
}: CanvasDocumentDialogProps) {
  const [minimized, setMinimized] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) setMinimized(false);
    onOpenChange(next);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange} modal={!minimized}>
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
          onMinimize={() => setMinimized(true)}
        >
          <DialogHeader className="shrink-0 border-b border-border/60 py-3 pr-28 pl-4">
            <DialogTitle className={titleClassName ?? "truncate text-sm"}>
              {title}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1">{children}</div>
        </ResizableDialogContent>
      </Dialog>
      {open && minimized && (
        <div
          data-testid="minimized-document"
          className="fixed bottom-4 left-4 z-50 flex max-w-xs items-center gap-1 rounded-lg border bg-background py-1 pr-1 pl-3 shadow-lg"
        >
          <span className="truncate text-xs">{title}</span>
          <button
            type="button"
            onClick={() => setMinimized(false)}
            className="rounded p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            aria-label={m.window_restore()}
            title={m.window_restore()}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="rounded p-1 text-muted-foreground hover:bg-muted/60 hover:text-destructive"
            aria-label={m.window_close()}
            title={m.window_close()}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  );
}
