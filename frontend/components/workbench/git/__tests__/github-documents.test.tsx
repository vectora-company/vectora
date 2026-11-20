// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import {
  githubDocumentDescriptor,
  renderGithubDocument,
} from "../github-documents";
import type { CanvasDocumentDescriptor } from "@/lib/stores/windows-store";

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy({}, { get: (_t, prop) => () => String(prop) }),
}));
vi.mock("@/components/workbench/markdown-view", () => ({
  MarkdownView: ({ content }: { content: string }) => <div>{content}</div>,
}));

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  // Nunca responde: o que interessa é qual tela foi montada e o que ela pediu.
  fetchMock.mockImplementation(() => new Promise(() => {}));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const doc = (
  overrides: Partial<CanvasDocumentDescriptor> = {},
): CanvasDocumentDescriptor => ({
  id: "pull-request:ws:7",
  kind: "pull-request",
  workspaceId: "ws",
  title: "#7 feat",
  githubNumber: 7,
  ...overrides,
});

describe("githubDocumentDescriptor", () => {
  it("guarda só o identificador, com id e título previsíveis", () => {
    expect(
      githubDocumentDescriptor(
        { kind: "workflow-run", number: 987654321, title: "feat: algo" },
        "ws1",
        "t1",
      ),
    ).toEqual({
      id: "workflow-run:ws1:987654321",
      kind: "workflow-run",
      workspaceId: "ws1",
      threadId: "t1",
      title: "#987654321 feat: algo",
      githubNumber: 987654321,
    });
  });

  it("o mesmo item sempre gera o mesmo id (abrir de novo não duplica a aba)", () => {
    const item = { kind: "issue" as const, number: 3, title: "bug" };

    expect(githubDocumentDescriptor(item, "ws", "a").id).toBe(
      githubDocumentDescriptor(item, "ws", "b").id,
    );
  });

  it("PR, issue e run com o mesmo número têm ids diferentes", () => {
    const ids = (["pull-request", "issue", "workflow-run"] as const).map(
      (kind) =>
        githubDocumentDescriptor({ kind, number: 5, title: "x" }, "ws", "t").id,
    );

    expect(new Set(ids).size).toBe(3);
  });

  it("workspaces diferentes não compartilham o id", () => {
    const item = { kind: "issue" as const, number: 3, title: "bug" };

    expect(githubDocumentDescriptor(item, "ws1", "t").id).not.toBe(
      githubDocumentDescriptor(item, "ws2", "t").id,
    );
  });
});

describe("renderGithubDocument", () => {
  it.each([
    ["pull-request", "github-pull-detail", "/github/pulls/7?"],
    ["issue", "github-issue-detail", "/github/issues/7?"],
    ["workflow-run", "github-run-detail", "/github/runs/7?"],
  ] as const)(
    "%s monta a tela certa e busca o item certo",
    (kind, testId, url) => {
      render(<>{renderGithubDocument(doc({ kind, id: `${kind}:ws:7` }))}</>);

      expect(screen.getByTestId(testId) ?? null).toBeTruthy();
      expect(String(fetchMock.mock.calls[0]![0])).toContain(url);
      expect(String(fetchMock.mock.calls[0]![0])).toContain("workspace_id=ws");
    },
  );

  it.each([
    ["sem número", { githubNumber: undefined }],
    ["número zero", { githubNumber: 0 }],
    ["sem workspace", { workspaceId: null }],
  ])(
    "descritor incompleto (%s) não monta nada nem busca",
    (_name, overrides) => {
      expect(renderGithubDocument(doc(overrides))).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    "file",
    "file-diff",
    "commit-details",
    "plan",
    "mcp-preview",
  ] as const)("kind %s não é do GitHub: devolve null", (kind) => {
    expect(renderGithubDocument(doc({ kind }))).toBeNull();
  });
});
