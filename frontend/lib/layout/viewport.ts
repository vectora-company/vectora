import type { Viewport } from "./window-geometry";

/** Variável CSS com a altura da barra de título própria do Electron. */
export const TITLEBAR_HEIGHT_VAR = "--titlebar-h";

/** Altura reservada no alto da janela (barra de título do Electron), em px. */
export function titleBarHeight(): number {
  if (typeof document === "undefined") return 0;
  // A TitleBar define a variável inline em <html>; ler dali evita depender de
  // getComputedStyle (que testes e embeds podem substituir).
  const raw = document.documentElement.style
    .getPropertyValue(TITLEBAR_HEIGHT_VAR)
    .trim();
  return Number.parseFloat(raw) || 0;
}

/** Área onde as janelas podem ficar: a viewport menos a barra de título. */
export function windowViewport(): Required<Viewport> {
  return {
    w: window.innerWidth,
    h: window.innerHeight,
    top: titleBarHeight(),
  };
}

/**
 * Diálogos modais não devem fechar quando o clique é na barra de título do
 * Electron, que fica fora deles mas precisa continuar utilizável (maximizar,
 * minimizar, fechar a janela).
 */
export function keepTitleBarUsable(event: {
  target: EventTarget | null;
  preventDefault: () => void;
}): void {
  if ((event.target as Element | null)?.closest?.("[data-titlebar]"))
    event.preventDefault();
}
