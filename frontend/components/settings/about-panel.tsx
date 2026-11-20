"use client";

/**
 * AboutPanel — categoria "Sobre" do SettingsOverlay.
 *
 * Versão do app não é informação administrativa — antes só existia
 * dentro de Administração → Sistema (gated por role admin/root). Usa
 * `GET /health`, rota pública (sem auth), em vez do `/admin/system`
 * gated que alimenta o painel de administração — nunca expõe os
 * diagnósticos internos (contagem de spans, DSN, etc.) que continuam
 * exclusivos de Administração.
 */

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";

import { useIsDesktop } from "@/lib/hooks/use-is-desktop";
import { m } from "@/lib/paraglide/messages";
import { settingsItemClass } from "@/components/settings/primitives";
import { DistributionChannels } from "@/components/settings/distribution-channels";
import { cn } from "@/lib/utils";

/** Projetos que inspiraram o Git Workbench; as licenças completas ficam em THIRD_PARTY_NOTICES.md. */
export const CREDITED_PROJECTS = [
  {
    id: "gitdesktop",
    url: "https://github.com/theBGuy/GitDesktop",
    label: () => m.about_credits_gitdesktop(),
  },
  {
    id: "githubdesktop",
    url: "https://github.com/desktop/desktop",
    label: () => m.about_credits_githubdesktop(),
  },
] as const;

function Credits() {
  return (
    <section className="space-y-1.5" data-testid="about-credits">
      <h3 className="text-xs font-semibold">{m.about_credits_title()}</h3>
      <p className="max-w-md text-2xs text-muted-foreground">
        {m.about_credits_intro()}
      </p>
      <ul className="space-y-1">
        {CREDITED_PROJECTS.map((project) => (
          <li key={project.id}>
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`about-credit-${project.id}`}
              className="text-xs text-primary underline-offset-2 hover:underline"
            >
              {project.label()}
            </a>
          </li>
        ))}
      </ul>
      <p className="text-2xs text-muted-foreground">
        {m.about_credits_licenses_hint()}
      </p>
    </section>
  );
}

export function AboutPanel() {
  const [version, setVersion] = useState<string | null>(null);
  const desktop = useIsDesktop();

  useEffect(() => {
    let cancelled = false;
    fetch("/health")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { version?: string } | null) => {
        if (!cancelled && d?.version) setVersion(d.version);
      })
      .catch(() => {
        // Silencioso — versão fica "—", não é informação crítica.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Image src="/vectora.svg" alt="Vectora" width={32} height={32} />
        <span
          className="text-lg font-semibold tracking-tight"
          style={{ fontFamily: "var(--font-aeonik-mono)" }}
        >
          Vectora
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 max-w-xs">
        <div className={cn(settingsItemClass, "p-3")}>
          <p className="text-2xs text-muted-foreground">
            {m.about_panel_version_label()}
          </p>
          <p className="text-xs font-medium font-mono">
            {version ?? <Loader2 className="w-3 h-3 animate-spin" />}
          </p>
        </div>
        <div className={cn(settingsItemClass, "p-3")}>
          <p className="text-2xs text-muted-foreground">
            {m.about_panel_mode_label()}
          </p>
          <p className="text-xs font-medium">
            {desktop ? m.about_panel_mode_desktop() : m.about_panel_mode_web()}
          </p>
        </div>
      </div>

      <DistributionChannels />

      <Credits />
    </div>
  );
}
