import type { ReactNode } from "react";

import { WorkbenchError } from "@/components/workbench/primitives";
import type {
  CanvasDocumentDescriptor,
  CanvasDocumentKind,
} from "@/lib/stores/windows-store";
import { m } from "@/lib/paraglide/messages";

export type CanvasDocumentRenderer = (
  document: CanvasDocumentDescriptor,
) => ReactNode;

export type CanvasDocumentRegistry = Partial<
  Record<CanvasDocumentKind, CanvasDocumentRenderer>
>;

export function renderCanvasDocument(
  document: CanvasDocumentDescriptor,
  registry: CanvasDocumentRegistry,
): ReactNode {
  const renderer = registry[document.kind];
  if (renderer) return renderer(document);
  return (
    <WorkbenchError testId="canvas-document-unknown">
      {m.workbench_document_renderer_unavailable({ kind: document.kind })}
    </WorkbenchError>
  );
}
