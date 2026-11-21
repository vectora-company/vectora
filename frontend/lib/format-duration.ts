/**
 * Durações curtas para execuções de CI: `42s`, `3m 12s`, `1h 2m`.
 * Entrada inválida vira "0s" (ms) ou "" (datas), nunca "NaN".
 */

/** Uma duração em milissegundos no formato curto. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m ${totalSeconds % 60}s`;
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
}

/**
 * O intervalo entre dois instantes ISO. Minuto cheio não mostra os segundos
 * (`3m`, não `3m 0s`). Vazio quando falta uma ponta, uma data é inválida ou
 * estão fora de ordem: um passo ainda em execução não tem duração para exibir.
 */
export function formatDurationBetween(start?: string, end?: string): string {
  if (!start || !end) return "";
  const from = new Date(start).getTime();
  const to = new Date(end).getTime();
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return "";
  const seconds = Math.round((to - from) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
