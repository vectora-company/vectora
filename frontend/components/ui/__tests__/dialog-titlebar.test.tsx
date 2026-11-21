// @vitest-environment jsdom
/**
 * Com um diálogo aberto a barra de título do Electron continua utilizável:
 * clicar nela não fecha o diálogo, e os overlays começam abaixo dela.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Dialog, DialogContent, DialogTitle } from "../dialog";
import { Sheet, SheetContent, SheetTitle } from "../sheet";
import { ResizableDialogContent } from "../resizable-dialog";
import { keepTitleBarUsable } from "@/lib/layout/viewport";

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy({}, { get: (_t, prop) => () => String(prop) }),
}));

afterEach(cleanup);

/** O Radix só passa a ouvir "clique fora" um instante depois de abrir. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

function TitleBarStub() {
  return (
    <div data-titlebar>
      <button type="button">maximizar</button>
    </div>
  );
}

describe("keepTitleBarUsable", () => {
  it("cancela o fechamento só quando o alvo está dentro da barra de título", () => {
    render(<TitleBarStub />);
    const inside = vi.fn();
    const outside = vi.fn();

    keepTitleBarUsable({
      target: screen.getByText("maximizar"),
      preventDefault: inside,
    });
    keepTitleBarUsable({ target: document.body, preventDefault: outside });

    expect(inside).toHaveBeenCalledOnce();
    expect(outside).not.toHaveBeenCalled();
  });
});

describe("diálogos e a barra de título", () => {
  it("Dialog: clicar na barra não fecha, clicar fora fecha", async () => {
    const onOpenChange = vi.fn();
    render(
      <>
        <TitleBarStub />
        <Dialog open onOpenChange={onOpenChange}>
          <DialogContent aria-describedby={undefined}>
            <DialogTitle>t</DialogTitle>
          </DialogContent>
        </Dialog>
        <div data-testid="fora">fora</div>
      </>,
    );

    await settle();
    fireEvent.pointerDown(screen.getByText("maximizar"));
    expect(onOpenChange).not.toHaveBeenCalled();

    const outside = screen.getByTestId("fora");
    fireEvent.pointerDown(outside);
    fireEvent.pointerUp(outside);
    fireEvent.click(outside);
    await settle();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("diálogo redimensionável: clicar na barra não fecha", async () => {
    const onOpenChange = vi.fn();
    render(
      <>
        <TitleBarStub />
        <Dialog open onOpenChange={onOpenChange}>
          <ResizableDialogContent aria-describedby={undefined}>
            <DialogTitle>t</DialogTitle>
          </ResizableDialogContent>
        </Dialog>
      </>,
    );

    await settle();
    fireEvent.pointerDown(screen.getByText("maximizar"));

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("Sheet: clicar na barra não fecha", async () => {
    const onOpenChange = vi.fn();
    render(
      <>
        <TitleBarStub />
        <Sheet open onOpenChange={onOpenChange}>
          <SheetContent aria-describedby={undefined}>
            <SheetTitle>t</SheetTitle>
          </SheetContent>
        </Sheet>
      </>,
    );

    await settle();
    fireEvent.pointerDown(screen.getByText("maximizar"));

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("os overlays começam abaixo da barra (usam --titlebar-h em vez de inset-0)", () => {
    render(
      <>
        <Dialog open>
          <DialogContent aria-describedby={undefined}>
            <DialogTitle>t</DialogTitle>
          </DialogContent>
        </Dialog>
        <Sheet open>
          <SheetContent aria-describedby={undefined}>
            <SheetTitle>t</SheetTitle>
          </SheetContent>
        </Sheet>
      </>,
    );

    for (const slot of ["dialog-overlay", "sheet-overlay"]) {
      const overlay = document.querySelector(`[data-slot="${slot}"]`)!;
      expect(overlay.className).toContain("top-[var(--titlebar-h,0px)]");
      expect(overlay.className).not.toContain("inset-0");
    }
  });
});
