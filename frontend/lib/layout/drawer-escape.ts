/**
 * Decide se um Esc global deve fechar a gaveta do layout compacto.
 *
 * A gaveta escuta `window`, então o mesmo Esc que fecha um diálogo, sai de um
 * campo de texto, do terminal ou do editor também a fecharia. Só fecha quando o
 * Esc não foi tratado por outro componente e não há diálogo aberto por cima.
 */
const OWNS_ESCAPE =
  "input, textarea, select, [contenteditable='true'], .xterm, .monaco-editor";
const OPEN_DIALOG =
  "[role='dialog'][data-state='open'], [role='alertdialog'][data-state='open'], [role='menu'][data-state='open']";

export function shouldCloseDrawerOnEscape(
  event: Pick<KeyboardEvent, "key" | "defaultPrevented" | "target">,
  root: ParentNode = document,
): boolean {
  if (event.key !== "Escape" || event.defaultPrevented) return false;
  const target = event.target;
  if (
    target instanceof Element &&
    target !== document.body &&
    target.closest(OWNS_ESCAPE)
  ) {
    return false;
  }
  return root.querySelector(OPEN_DIALOG) === null;
}
