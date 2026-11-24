import { describe, expect, it } from "vitest";

import { renderToStaticMarkup } from "react-dom/server";
import { renderCanvasDocument } from "../document-registry";
import type { CanvasDocumentDescriptor } from "@/lib/stores/windows-store";

const document: CanvasDocumentDescriptor = {
  id: "unknown:ws1",
  kind: "file",
  workspaceId: "ws1",
  title: "file",
};

describe("canvas document registry", () => {
  it("renders the registered document type", () => {
    const markup = renderToStaticMarkup(
      <>
        {renderCanvasDocument(document, { file: () => <p>file renderer</p> })}
      </>,
    );

    expect(markup).toContain("file renderer");
  });

  it("shows an error when the document type has no renderer", () => {
    const markup = renderToStaticMarkup(
      <>{renderCanvasDocument(document, {})}</>,
    );

    expect(markup).toContain("canvas-document-unknown");
    expect(markup).toContain("No renderer is registered");
  });
});
