// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditorTab } from "../editor-tab";

function renderTab(onSaveAs = vi.fn().mockResolvedValue(true)) {
  render(
    <EditorTab
      name="main.py"
      path="src/main.py"
      active
      dirty={false}
      onActivate={vi.fn()}
      onClose={vi.fn()}
      onSave={vi.fn().mockResolvedValue(true)}
      onSaveAs={onSaveAs}
    />,
  );
  return onSaveAs;
}

async function openSaveAs() {
  fireEvent.contextMenu(screen.getByRole("tab"));
  const item = await screen.findByRole("menuitem", {
    name: /save as|salvar como/i,
  });
  fireEvent.click(item);
  return screen.findByRole("dialog");
}

describe("EditorTab — Salvar como", () => {
  it("abre um diálogo com o caminho atual em vez de window.prompt", async () => {
    const prompt = vi.spyOn(window, "prompt");
    renderTab();

    const dialog = await openSaveAs();

    expect(prompt).not.toHaveBeenCalled();
    expect(dialog.querySelector("input")).toHaveValue("src/main.py");
    prompt.mockRestore();
  });

  it("salvar envia o caminho digitado, sem espaços nas pontas", async () => {
    const onSaveAs = renderTab();
    const dialog = await openSaveAs();

    fireEvent.change(dialog.querySelector("input")!, {
      target: { value: "  src/novo.py  " },
    });
    fireEvent.submit(dialog.querySelector("form")!);

    await waitFor(() => expect(onSaveAs).toHaveBeenCalledWith("src/novo.py"));
  });

  it("borda: caminho vazio não salva e o botão fica desabilitado", async () => {
    const onSaveAs = renderTab();
    const dialog = await openSaveAs();

    fireEvent.change(dialog.querySelector("input")!, {
      target: { value: "  " },
    });
    fireEvent.submit(dialog.querySelector("form")!);

    expect(onSaveAs).not.toHaveBeenCalled();
    expect(dialog.querySelector("button[type=submit]")).toBeDisabled();
  });
});
