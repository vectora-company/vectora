import { useLayoutEffect, type RefObject } from "react";

/**
 * Faz um `<textarea>` crescer com o conteúdo até `maxHeight` (px); passando
 * disso, mantém a altura e passa a rolar. Também encolhe ao apagar texto.
 */
export function useAutoGrow(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  maxHeight: number,
): void {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    // Zera para medir a altura natural do conteúdo (permite encolher).
    element.style.height = "auto";
    const natural = element.scrollHeight;
    element.style.height = `${Math.min(natural, maxHeight)}px`;
    element.style.overflowY = natural > maxHeight ? "auto" : "hidden";
    // `value` não é lido aqui de propósito: só dispara a nova medição.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [ref, value, maxHeight]);
}
