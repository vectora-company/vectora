"use client";

import type { ReactNode, RefObject } from "react";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ResizableDialogContent } from "@/components/ui/resizable-dialog";

interface WorkbenchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  bodyRef?: RefObject<HTMLDivElement | null>;
  testId?: string;
  children: ReactNode;
  bodyMode?: "scroll" | "fill";
}

/** Host modal responsivo compartilhado pelas configurações das workbenches. */
export function WorkbenchDialog({
  open,
  onOpenChange,
  title,
  description,
  bodyRef,
  testId,
  children,
  bodyMode = "scroll",
}: WorkbenchDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResizableDialogContent
        storageKey="workbench-dialog"
        defaultWidth={1248}
        defaultHeight={832}
        minWidth={640}
        minHeight={420}
        className="gap-0 p-0 overflow-hidden"
        data-testid={testId}
      >
        <DialogHeader className="shrink-0 border-b border-border/60 px-4 py-3 pr-12">
          <DialogTitle className="truncate text-sm">{title}</DialogTitle>
          <DialogDescription className={description ? undefined : "sr-only"}>
            {description ?? title}
          </DialogDescription>
        </DialogHeader>
        <div
          ref={bodyRef}
          className={`min-h-0 flex-1 overflow-x-hidden ${
            bodyMode === "fill"
              ? "flex flex-col overflow-y-hidden"
              : "overflow-y-auto"
          }`}
        >
          {children}
        </div>
      </ResizableDialogContent>
    </Dialog>
  );
}
