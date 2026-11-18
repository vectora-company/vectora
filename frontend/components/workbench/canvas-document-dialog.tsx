"use client";

import type { ReactNode } from "react";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResizableDialogContent } from "@/components/ui/resizable-dialog";

interface CanvasDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  titleClassName?: string;
  children: ReactNode;
}

/** Modal único para documentos abertos a partir do canvas compartilhado. */
export function CanvasDocumentDialog({
  open,
  onOpenChange,
  title,
  titleClassName,
  children,
}: CanvasDocumentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResizableDialogContent
        storageKey="canvas-document"
        defaultWidth={1248}
        defaultHeight={832}
        minWidth={480}
        minHeight={320}
        maxWidth={1600}
        maxHeight={1200}
        className="max-h-[85vh] max-w-[92vw] gap-0 p-0"
        aria-describedby={undefined}
      >
        <DialogHeader className="shrink-0 border-b border-border/60 px-4 py-3">
          <DialogTitle className={titleClassName ?? "truncate text-sm"}>
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1">{children}</div>
      </ResizableDialogContent>
    </Dialog>
  );
}
