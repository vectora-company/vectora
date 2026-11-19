"use client";

import { Info } from "lucide-react";

import {
  servicesDisabled,
  useLicenseStatus,
} from "@/lib/hooks/use-license-status";
import { m } from "@/lib/paraglide/messages";

/** `true` quando esta execução foi iniciada com `--no-services`. */
export function useServicesDisabled(): boolean {
  const { status } = useLicenseStatus();
  return servicesDisabled(status);
}

/**
 * Aviso de que o Services está desligado nesta execução. Aparece nas telas de
 * conta, licença e login, para um recurso indisponível não parecer falha de
 * rede. Não renderiza nada com o Services ligado.
 */
export function ServicesOffNotice({ className = "" }: { className?: string }) {
  const off = useServicesDisabled();
  if (!off) return null;
  return (
    <p
      role="status"
      data-testid="services-off-notice"
      className={`flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground ${className}`}
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {m.services_off_notice()}
    </p>
  );
}
