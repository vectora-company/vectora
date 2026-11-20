/**
 * Estados de um run ou job do GitHub Actions.
 *
 * `status` diz onde o run está (fila, execução, concluído) e `conclusion` só
 * existe depois de concluído. A interface lê os dois por estas funções, para
 * lista, detalhe e jobs concordarem sobre o que é "em andamento" e "falha".
 */

const ACTIVE_STATUSES = new Set([
  "queued",
  "in_progress",
  "waiting",
  "requested",
  "pending",
]);

const QUEUED_STATUSES = new Set(["queued", "waiting", "requested", "pending"]);

const FAILURE_CONCLUSIONS = new Set([
  "failure",
  "timed_out",
  "startup_failure",
]);

/** Ainda não terminou: na fila ou executando (a tela continua relendo). */
export function isRunActive(status: string): boolean {
  return ACTIVE_STATUSES.has(status);
}

/** Terminou com erro. Cancelado e pulado não contam como falha. */
export function isFailureConclusion(conclusion: string): boolean {
  return FAILURE_CONCLUSIONS.has(conclusion);
}

export type RunStatusKind =
  | "queued"
  | "running"
  | "success"
  | "failure"
  | "cancelled"
  | "skipped"
  | "neutral";

/** Um único rótulo visual (ícone e cor) a partir de `status` e `conclusion`. */
export function runStatusKind(
  status: string,
  conclusion: string,
): RunStatusKind {
  if (status === "in_progress") return "running";
  if (QUEUED_STATUSES.has(status)) return "queued";
  if (conclusion === "success") return "success";
  if (isFailureConclusion(conclusion)) return "failure";
  if (conclusion === "cancelled") return "cancelled";
  if (conclusion === "skipped") return "skipped";
  return "neutral";
}
