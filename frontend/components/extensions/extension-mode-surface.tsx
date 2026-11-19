"use client";

import { ExtensionFrame } from "./extension-frame";
import { useExtensionsStore } from "@/lib/stores/extensions-store";

/**
 * Cobre a área de trabalho com a página do modo que a extensão contribuiu.
 * O header e o seletor de modos ficam por fora, então voltar a um modo nativo
 * é sempre um clique; os modos nativos continuam intactos por baixo.
 */
export function ExtensionModeSurface() {
  const mode = useExtensionsStore((state) =>
    state.contributions.find((item) => item.id === state.activeModeId),
  );
  if (!mode || mode.kind !== "mode") return null;
  return (
    <div
      data-testid="extension-mode-surface"
      className="absolute inset-0 z-20 bg-background"
    >
      <ExtensionFrame contribution={mode} />
    </div>
  );
}
