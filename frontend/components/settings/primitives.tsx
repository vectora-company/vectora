"use client";

/**
 * Primitivas visuais das telas de Settings.
 *
 * Um único lugar define o card, os títulos, o rótulo e os selos de estado,
 * sempre com os tokens do tema (`bg-card`, `border-border`, `text-success`...).
 * Nenhuma tela de Settings deve repetir essas classes à mão nem usar hex,
 * `text-[Npx]` ou cores cruas do Tailwind: o teste
 * `settings-style-guard.test.ts` varre o diretório e reprova.
 *
 * Medidas (iguais às de Provider Routing e AI Models): card com `p-4`, 12px
 * entre os grupos internos, raio de 8px e 24px entre cards.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { m } from "@/lib/paraglide/messages";

/** Item de lista com borda própria (integração, plugin, memória), sem padding. */
export const settingsItemClass = "rounded-lg border border-border bg-card";

/** Linha interna de um card (também usada pelo componente `SettingsRow`). */
export const settingsRowClass =
  "flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2";

/**
 * Contêiner rolável das listas longas (modelos detectados, registrados): a
 * lista rola dentro da seção em vez de empurrar a página. Aplique quando houver
 * mais de seis itens, ou sempre que a lista puder crescer sem limite.
 */
export const settingsScrollListClass = "max-h-[26rem] overflow-y-auto pr-1";

/** Rótulo que envolve o controle: texto acima, controle abaixo. */
export const settingsLabelClass = "grid gap-1 text-xs text-foreground";

/** Rótulo de opção (caixa de marcação ou seleção ao lado do texto). */
export const settingsOptionClass =
  "flex items-center gap-2 text-xs text-foreground";

/** Área de texto ou campo largo, com um pouco mais de respiro que o campo. */
export const settingsTextareaClass =
  "w-full rounded-md border border-input bg-background p-2 text-sm text-foreground";

/** Campo nativo de texto, número ou seleção. */
export const settingsInputClass =
  "h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground";

/** Coluna de uma aba de Settings: 24px entre os blocos. */
export function SettingsStack({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-6", className)} {...props} />;
}

/** Título e descrição da aba. */
export function SettingsTabHeader({
  title,
  description,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("space-y-1", className)}>
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      {description ? (
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      ) : null}
    </header>
  );
}

/** Classe do card de uma seção (também usada pelo componente `SettingsSection`). */
export const settingsSectionClass =
  "space-y-3 rounded-lg border border-border p-4";

interface SettingsSectionHeaderProps {
  /** Sem título nem ações, o cabeçalho não é renderizado. */
  title?: React.ReactNode;
  /** `id` do título, para `aria-labelledby` na seção. */
  titleId?: string;
  description?: React.ReactNode;
  /** Ícone já renderizado (Lucide ou ícone de provider), 16px. */
  icon?: React.ReactNode;
  /** Estado e ações do cabeçalho, alinhados à direita quando há espaço. */
  actions?: React.ReactNode;
}

/** Cabeçalho de uma seção: ícone, título, descrição e ações. */
export function SettingsSectionHeader({
  title,
  titleId,
  description,
  icon,
  actions,
}: SettingsSectionHeaderProps) {
  if (!title && !actions) return null;
  return (
    <div
      data-slot="settings-section-header"
      className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2"
    >
      <div className="min-w-0 space-y-1">
        <h3
          id={titleId}
          className="flex items-center gap-1.5 text-sm font-medium text-foreground"
        >
          {icon ? (
            <span className="inline-flex size-4 shrink-0 items-center justify-center text-muted-foreground">
              {icon}
            </span>
          ) : null}
          {title}
        </h3>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

interface SettingsNavItem {
  id: string;
  label: string;
}

/**
 * Menu "Nesta página": lista os cards da aba (filhos diretos do mesmo
 * container, com cabeçalho de seção) e rola até o escolhido. Aparece só quando
 * há mais de um card.
 */
export function SettingsPageNav({ className }: { className?: string }) {
  const navRef = React.useRef<HTMLElement>(null);
  const [items, setItems] = React.useState<SettingsNavItem[]>([]);

  React.useEffect(() => {
    const container = navRef.current?.parentElement;
    if (!container) return;
    const scan = () => {
      const next: SettingsNavItem[] = [];
      container
        .querySelectorAll<HTMLElement>('[data-slot="settings-section-header"]')
        .forEach((header, index) => {
          const card = header.parentElement;
          if (!card || card.parentElement !== container) return;
          const label = header.querySelector("h3")?.textContent?.trim();
          if (!label) return;
          if (!card.id) card.id = `settings-nav-${index}`;
          card.classList.add("scroll-mt-4");
          next.push({ id: card.id, label });
        });
      setItems((prev) =>
        prev.length === next.length &&
        prev.every(
          (item, i) => item.id === next[i].id && item.label === next[i].label,
        )
          ? prev
          : next,
      );
    };
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(container, { childList: true });
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      ref={navRef}
      aria-label={m.workbench_settings_page_aria()}
      hidden={items.length < 2}
      className={cn("min-w-0", className)}
    >
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        {m.workbench_settings_page_index()}
      </p>
      <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() =>
              document
                .getElementById(item.id)
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="break-words text-left text-primary hover:underline"
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

interface SettingsSectionProps
  extends
    Omit<React.HTMLAttributes<HTMLElement>, "title">,
    SettingsSectionHeaderProps {}

/** Card de uma seção: borda do tema, raio 8px, `p-4`, 12px entre grupos. */
export function SettingsSection({
  title,
  titleId,
  description,
  icon,
  actions,
  className,
  children,
  ...props
}: SettingsSectionProps) {
  return (
    <section
      data-slot="settings-section"
      className={cn(settingsSectionClass, className)}
      {...props}
    >
      <SettingsSectionHeader
        title={title}
        titleId={titleId}
        description={description}
        icon={icon}
        actions={actions}
      />
      {children}
    </section>
  );
}

/** Linha interna de um card: item de lista, modelo registrado, status. */
export function SettingsRow({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="settings-row"
      className={cn(settingsRowClass, className)}
      {...props}
    />
  );
}

/** Campo com rótulo associado ao controle e texto de ajuda opcional. */
export function SettingsField({
  label,
  hint,
  htmlFor,
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-1", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export type SettingsTone =
  "success" | "warning" | "danger" | "info" | "neutral";

const STATUS_TONES: Record<SettingsTone, string> = {
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  info: "border-info/30 bg-info/10 text-info",
  neutral: "border-border bg-muted text-muted-foreground",
};

/** Selo de estado (configurado, indisponível, em uso...). */
export function SettingsStatus({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: SettingsTone }) {
  return (
    <span
      data-slot="settings-status"
      data-tone={tone}
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wider",
        STATUS_TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

const MESSAGE_TONES: Record<SettingsTone, string> = {
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  info: "border-info/30 bg-info/10 text-info",
  neutral: "border-border bg-muted/40 text-muted-foreground",
};

/** Mensagem inline de erro, aviso ou informação dentro de uma seção. */
export function SettingsMessage({
  tone = "info",
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement> & { tone?: SettingsTone }) {
  return (
    <p
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      data-slot="settings-message"
      data-tone={tone}
      className={cn(
        "rounded-md border px-3 py-2 text-xs",
        MESSAGE_TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
