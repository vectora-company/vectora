"use client";

/**
 * Ícone do estado de um run, job ou passo. Um único mapeamento de estado para
 * ícone e cor (tokens do tema), usado pela lista e pelo detalhe.
 */

import {
  CheckCircle2,
  Circle,
  CircleDashed,
  Loader2,
  MinusCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { m } from "@/lib/paraglide/messages";
import { runStatusKind, type RunStatusKind } from "@/lib/github/run-status";
import { cn } from "@/lib/utils";

const ICONS: Record<RunStatusKind, { icon: LucideIcon; className: string }> = {
  queued: { icon: CircleDashed, className: "text-amber-500" },
  running: { icon: Loader2, className: "animate-spin text-amber-500" },
  success: { icon: CheckCircle2, className: "text-emerald-500" },
  failure: { icon: XCircle, className: "text-destructive" },
  cancelled: { icon: MinusCircle, className: "text-muted-foreground" },
  skipped: { icon: MinusCircle, className: "text-muted-foreground/60" },
  neutral: { icon: Circle, className: "text-muted-foreground" },
};

/** Texto do estado, para o leitor de tela e o crachá do cabeçalho. */
export function runStatusLabel(kind: RunStatusKind): string {
  switch (kind) {
    case "queued":
      return m.workbench_actions_state_queued();
    case "running":
      return m.workbench_actions_state_running();
    case "success":
      return m.workbench_actions_state_success();
    case "failure":
      return m.workbench_actions_state_failure();
    case "cancelled":
      return m.workbench_actions_state_cancelled();
    case "skipped":
      return m.workbench_actions_state_skipped();
    default:
      return m.workbench_actions_state_neutral();
  }
}

export function RunStatusIcon({
  status,
  conclusion,
  className,
}: {
  status: string;
  conclusion: string;
  className?: string;
}) {
  const kind = runStatusKind(status, conclusion);
  const { icon: Icon, className: tone } = ICONS[kind];
  return (
    <Icon
      role="img"
      aria-label={runStatusLabel(kind)}
      data-status-kind={kind}
      className={cn("h-4 w-4 shrink-0", tone, className)}
    />
  );
}
