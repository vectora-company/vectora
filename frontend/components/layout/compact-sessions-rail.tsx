import { Plus } from "lucide-react";

import { RailToggleButton } from "@/components/layout/rail-toggle-button";
import { m } from "@/lib/paraglide/messages";

interface CompactSessionsRailProps {
  side: "left" | "right";
  open: boolean;
  onToggle: () => void;
  onNewChat: () => void;
}

/**
 * Faixa estreita de sessões do layout compacto (tablet). Fica sempre visível
 * na borda; a lista de sessões abre como gaveta sobre o conteúdo.
 */
export function CompactSessionsRail({
  side,
  open,
  onToggle,
  onNewChat,
}: CompactSessionsRailProps) {
  return (
    <nav
      data-testid="compact-sessions-rail"
      aria-label={m.mobile_shell_controls()}
      className={`flex h-full w-12 shrink-0 flex-col items-center bg-sidebar pb-[max(0.5rem,env(safe-area-inset-bottom))] ${
        side === "left" ? "border-r" : "border-l"
      } border-border/60`}
    >
      {/* A faixa é uma coluna do shell: o topo tem a altura do header, como o
          resto das colunas laterais, e o header só cobre a coluna central. */}
      <div className="flex h-[var(--app-header-height)] w-full shrink-0 items-center justify-center border-b border-border/60">
        <RailToggleButton
          side={side}
          ariaLabel={m.mobile_open_sessions()}
          ariaExpanded={open}
          onClick={onToggle}
          data-testid="compact-rail-sessions"
        />
      </div>
      <button
        type="button"
        data-testid="compact-rail-new-chat"
        aria-label={m.sidebar_new_chat()}
        title={m.sidebar_new_chat()}
        onClick={onNewChat}
        className="mt-2 flex h-7 w-7 pointer-coarse:h-10 pointer-coarse:w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
