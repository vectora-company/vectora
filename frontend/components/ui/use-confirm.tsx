"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { m } from "@/lib/paraglide/messages";

export interface ConfirmOptions {
  /** Texto da pergunta, já traduzido. */
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
}

interface Pending {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

/**
 * Substitui `window.confirm` pelo diálogo do produto.
 *
 * `confirm()` devolve uma promessa que resolve `true` ao confirmar e `false` ao
 * cancelar ou fechar; renderize `dialog` uma vez no componente.
 *
 * @example
 *   const { confirm, dialog } = useConfirm();
 *   if (!(await confirm({ message: m.skills_confirm_remove(), variant: "destructive" }))) return;
 *   return <>{...}{dialog}</>;
 */
export function useConfirm(): {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  const settle = useCallback((value: boolean) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    current?.resolve(value);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        // Uma pergunta nova cancela a anterior, que ainda esperava resposta.
        pendingRef.current?.resolve(false);
        const next = { options, resolve };
        pendingRef.current = next;
        setPending(next);
      }),
    [],
  );

  // Se o componente sair da tela com a pergunta aberta, o chamador não fica pendurado.
  useEffect(() => () => pendingRef.current?.resolve(false), []);

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      title={pending?.options.title ?? m.confirm_dialog_title()}
      description={pending?.options.message}
      confirmLabel={pending?.options.confirmLabel}
      cancelLabel={pending?.options.cancelLabel}
      variant={pending?.options.variant}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return { confirm, dialog };
}
