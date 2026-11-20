"use client";

import { useMemo } from "react";
import { extensionIcon } from "@/lib/extensions/icons";
import { contributionsOfKind } from "@/lib/extensions/registry";
import { useExtensionsStore } from "@/lib/stores/extensions-store";

/** Modos contribuídos por extensões ativas, ao lado dos modos nativos. */
export function ExtensionModeButtons() {
  const contributions = useExtensionsStore((state) => state.contributions);
  const activeModeId = useExtensionsStore((state) => state.activeModeId);
  const setActiveMode = useExtensionsStore((state) => state.setActiveMode);
  const modes = useMemo(
    () => contributionsOfKind(contributions, "mode"),
    [contributions],
  );
  if (modes.length === 0) return null;
  return (
    <div
      data-testid="extension-mode-buttons"
      className="ml-1 flex h-full items-stretch border-l border-border/60 pl-1"
    >
      {modes.map((mode) => {
        const Icon = extensionIcon(mode.icon);
        const active = activeModeId === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            aria-pressed={active}
            title={mode.label}
            onClick={() => setActiveMode(active ? null : mode.id)}
            className={`flex h-full min-h-11 items-center gap-1.5 px-2.5 text-xs transition-colors ${
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="whitespace-nowrap">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
