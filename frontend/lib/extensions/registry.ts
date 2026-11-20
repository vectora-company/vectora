/**
 * Registro das contribuições de interface das extensões.
 *
 * O host (backend) devolve só dados: tipo, rótulo, ícone e a página da
 * extensão. Este módulo valida e resolve esses dados de forma determinística,
 * para que modos, abas, páginas de Configurações, ações de header e ícones de
 * arquivo entrem na interface sem editar os componentes centrais a cada
 * extensão. Uma contribuição nunca carrega código para dentro do app.
 */

export type ContributionKind =
  "mode" | "workbench_view" | "settings_page" | "header_action" | "file_icon";

export interface ExtensionContribution {
  /** Id efetivo, sem colisão: `<extensão>.<tipo>.<id>`. */
  id: string;
  extension_id: string;
  kind: ContributionKind;
  label: string;
  icon?: string | null;
  /** Página da extensão, relativa a `ui/` no pacote. */
  entry?: string | null;
  file_extensions?: string[];
}

interface RejectedContribution {
  id: string;
  reason: "unknown_kind" | "missing_entry" | "duplicate_id" | "reserved_id";
}

export interface ResolvedContributions {
  accepted: ExtensionContribution[];
  rejected: RejectedContribution[];
}

const KINDS: ReadonlySet<string> = new Set([
  "mode",
  "workbench_view",
  "settings_page",
  "header_action",
  "file_icon",
]);
const KINDS_WITH_PAGE: ReadonlySet<string> = new Set([
  "mode",
  "workbench_view",
  "settings_page",
  "header_action",
]);

/** Ids dos controles do próprio Vectora: contribuição nenhuma os substitui. */
const RESERVED_IDS: ReadonlySet<string> = new Set([
  "assistant",
  "ide",
  "kanban",
  "files",
  "git",
  "terminal",
  "settings",
]);

function compare(a: ExtensionContribution, b: ExtensionContribution): number {
  return (
    a.extension_id.localeCompare(b.extension_id) || a.id.localeCompare(b.id)
  );
}

/**
 * Valida e ordena as contribuições. A ordem é estável (extensão, depois id);
 * em conflito de id a primeira vence e as demais voltam em `rejected`, sem
 * quebrar a interface.
 */
export function resolveContributions(
  items: readonly ExtensionContribution[],
): ResolvedContributions {
  const accepted: ExtensionContribution[] = [];
  const rejected: RejectedContribution[] = [];
  const seen = new Set<string>();
  for (const item of items.toSorted(compare)) {
    if (!KINDS.has(item.kind)) {
      rejected.push({ id: item.id, reason: "unknown_kind" });
    } else if (RESERVED_IDS.has(item.id.split(".").pop() ?? "")) {
      rejected.push({ id: item.id, reason: "reserved_id" });
    } else if (KINDS_WITH_PAGE.has(item.kind) && !item.entry) {
      rejected.push({ id: item.id, reason: "missing_entry" });
    } else if (seen.has(item.id)) {
      rejected.push({ id: item.id, reason: "duplicate_id" });
    } else {
      seen.add(item.id);
      accepted.push(item);
    }
  }
  return { accepted, rejected };
}

export function contributionsOfKind(
  items: readonly ExtensionContribution[],
  kind: ContributionKind,
): ExtensionContribution[] {
  return items.filter((item) => item.kind === kind);
}

/** URL da página de uma contribuição, servida pelo host. */
export function contributionPageUrl(
  item: ExtensionContribution,
): string | null {
  if (!item.entry) return null;
  const path = item.entry.split("/").map(encodeURIComponent).join("/");
  return `/extensions/${encodeURIComponent(item.extension_id)}/ui/${path}`;
}

/** Ícone de arquivo contribuído para um nome de arquivo, se houver. */
export function fileIconFor(
  items: readonly ExtensionContribution[],
  fileName: string,
): ExtensionContribution | null {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return null;
  const extension = fileName.slice(dot + 1).toLowerCase();
  return (
    contributionsOfKind(items, "file_icon").find((item) =>
      (item.file_extensions ?? []).some(
        (ext) => ext.toLowerCase() === extension,
      ),
    ) ?? null
  );
}
