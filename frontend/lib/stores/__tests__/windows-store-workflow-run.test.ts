import { beforeEach, describe, expect, it } from "vitest";

import { useWindowsStore } from "../windows-store";

type Restored = {
  canvasDocuments: Array<{ id: string; githubNumber?: number }>;
};

const migrate = (state: unknown): Restored =>
  (
    useWindowsStore.persist.getOptions().migrate as (
      state: unknown,
      version: number,
    ) => Restored
  )(state, 1);

const runDocument = (githubNumber: unknown, id = "workflow-run:ws:1") => ({
  id,
  kind: "workflow-run",
  workspaceId: "ws",
  title: "#1 feat",
  githubNumber,
});

beforeEach(() => {
  useWindowsStore.getState().closeAll();
});

describe("windows-store — documents de run do Actions", () => {
  it("abrir um run guarda só o id e o deixa ativo", () => {
    useWindowsStore.getState().openCanvasDocument({
      id: "workflow-run:ws:987654321",
      kind: "workflow-run",
      workspaceId: "ws",
      title: "feat: algo",
      githubNumber: 987654321,
    });

    const state = useWindowsStore.getState();
    expect(state.canvasDocuments[0]?.githubNumber).toBe(987654321);
    expect(state.activeCanvasDocumentId).toBe("workflow-run:ws:987654321");
  });

  it("ids de run grandes (acima de 32 bits) são restaurados", () => {
    const restored = migrate({
      canvasDocuments: [runDocument(19_876_543_210)],
    });

    expect(restored.canvasDocuments.map((d) => d.githubNumber)).toEqual([
      19_876_543_210,
    ]);
  });

  it.each([
    ["sem id", undefined],
    ["zero", 0],
    ["negativo", -4],
    ["fracionário", 2.5],
    ["texto", "123"],
    ["acima do inteiro seguro", Number.MAX_SAFE_INTEGER + 10],
    ["infinito", Number.POSITIVE_INFINITY],
  ])("descarta um run com id inválido (%s)", (_name, id) => {
    expect(
      migrate({ canvasDocuments: [runDocument(id)] }).canvasDocuments,
    ).toEqual([]);
  });

  it("minimizar e restaurar um run funciona como nos outros documents", () => {
    const store = useWindowsStore.getState();
    store.openCanvasDocument({
      id: "workflow-run:ws:7",
      kind: "workflow-run",
      workspaceId: "ws",
      title: "run",
      githubNumber: 7,
    });

    store.minimizeCanvasDocument("workflow-run:ws:7");
    expect(useWindowsStore.getState().minimizedCanvasDocumentIds).toEqual([
      "workflow-run:ws:7",
    ]);

    store.restoreCanvasDocument("workflow-run:ws:7");
    expect(useWindowsStore.getState().activeCanvasDocumentId).toBe(
      "workflow-run:ws:7",
    );
  });
});
