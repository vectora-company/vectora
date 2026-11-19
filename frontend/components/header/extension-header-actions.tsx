"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { extensionIcon } from "@/lib/extensions/icons";
import { contributionsOfKind } from "@/lib/extensions/registry";
import { useExtensionsStore } from "@/lib/stores/extensions-store";
import { ExtensionFrame } from "@/components/extensions/extension-frame";

/** Ações que extensões ativas colocam no header; cada uma abre a página da extensão. */
export function ExtensionHeaderActions() {
  const contributions = useExtensionsStore((state) => state.contributions);
  const actions = useMemo(
    () => contributionsOfKind(contributions, "header_action"),
    [contributions],
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const open = actions.find((action) => action.id === openId) ?? null;

  if (actions.length === 0) return null;
  return (
    <>
      <div
        data-testid="extension-header-actions"
        className="flex items-center gap-1"
      >
        {actions.map((action) => {
          const Icon = extensionIcon(action.icon);
          return (
            <button
              key={action.id}
              type="button"
              title={action.label}
              aria-label={action.label}
              onClick={() => setOpenId(action.id)}
              className="flex h-8 min-h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon className="h-4 w-4" aria-hidden />
            </button>
          );
        })}
      </div>
      <Dialog
        open={open !== null}
        onOpenChange={(next) => !next && setOpenId(null)}
      >
        {open && (
          <DialogContent className="h-[70vh] max-w-3xl">
            <DialogTitle>{open.label}</DialogTitle>
            <ExtensionFrame contribution={open} />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
