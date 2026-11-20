"use client";

/**
 * Estados e barra de ferramentas comuns das abas do workbench.
 *
 * Cada aba montava o seu próprio spinner, texto de vazio, bloco de erro e
 * barra de ações, com espaçamentos e cores diferentes. Estas primitivas fixam
 * um único visual para os quatro casos.
 */

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { m } from "@/lib/paraglide/messages";

/** Barra de ações no topo da aba, alinhada à esquerda. */
export function WorkbenchToolbar({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative flex shrink-0 items-center justify-start gap-2 border-b border-border/60 px-3 py-2 ${className}`}
    >
      {children}
    </div>
  );
}

/** Carregamento da aba inteira. */
export function WorkbenchLoading() {
  return (
    <div
      role="status"
      aria-label={m.workbench_loading()}
      className="flex h-full items-center justify-center text-muted-foreground"
    >
      <Loader2 className="h-4 w-4 animate-spin" />
    </div>
  );
}

/** Estado vazio: centralizado com ícone, ou em linha (`compact`) dentro de uma seção. */
export function WorkbenchEmpty({
  children,
  icon,
  compact = false,
  testId,
}: {
  children: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
  testId?: string;
}) {
  if (compact) {
    return (
      <p
        className="px-2.5 py-2 text-xs text-muted-foreground"
        data-testid={testId}
      >
        {children}
      </p>
    );
  }
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-3 overflow-y-auto p-4 text-center"
      data-testid={testId}
    >
      {icon}
      <p className="text-xs text-muted-foreground">{children}</p>
    </div>
  );
}

/** Erro da aba, sempre visível. */
export function WorkbenchError({
  children,
  testId,
}: {
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div
      role="alert"
      className="overflow-y-auto px-3 py-2 text-sm text-destructive"
      data-testid={testId}
    >
      {children}
    </div>
  );
}

/** Seção de uma aba: título pequeno em caixa alta, com ícone, e o conteúdo. */
export function WorkbenchSection({
  icon,
  title,
  testId,
  children,
}: {
  icon?: ReactNode;
  title: ReactNode;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-1.5" data-testid={testId}>
      <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground [&_svg]:h-3 [&_svg]:w-3">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Linha de botões de ação, abaixo do texto a que se referem: ficam juntos, na
 * mesma linha, e quebram para a seguinte só se faltar largura.
 */
export function WorkbenchActions({
  children,
  testId,
}: {
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid={testId}>
      {children}
    </div>
  );
}
