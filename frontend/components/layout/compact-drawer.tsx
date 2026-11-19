"use client";

import { useCallback, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

/**
 * Gaveta única das colunas laterais do shell no modo compacto.
 *
 * Sessões, workbench e o chat do IDE abrem do mesmo jeito: um Sheet com o fundo
 * escuro, foco e Esc do Radix, por cima de tudo (header e composer incluídos) e
 * com o conteúdo da própria coluna, igual ao do layout largo. A faixa estreita
 * que fica no shell só abre e fecha a gaveta.
 */
type CompactDrawerSize = "narrow" | "wide";

const SIZE_CLASS: Record<CompactDrawerSize, string> = {
  narrow: "w-72 max-w-[calc(100vw-3rem)]",
  wide: "w-[min(32rem,calc(100vw-3rem))] max-w-[calc(100vw-3rem)]",
};

interface CompactDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: "left" | "right";
  /** Nome acessível da gaveta (leitores de tela). */
  title: string;
  size?: CompactDrawerSize;
  /**
   * Mantém o conteúdo montado ao fechar, para não perder o estado dele (um
   * stream em andamento, por exemplo). O Radix desmonta o conteúdo ao fechar e,
   * com `forceMount`, esconderia o resto do app dos leitores de tela o tempo
   * todo; por isso o conteúdo vive num nó próprio, que só é encaixado na gaveta
   * enquanto ela está aberta.
   */
  keepMounted?: boolean;
  showCloseButton?: boolean;
  "data-testid"?: string;
  children: ReactNode;
}

const FILL_CLASS =
  "flex min-h-0 min-w-0 flex-1 overflow-hidden [&>*]:w-full [&>*]:flex-1";

function createHost(): HTMLDivElement | null {
  if (typeof document === "undefined") return null;
  const host = document.createElement("div");
  host.className = FILL_CLASS;
  return host;
}

/** Encaixa o nó persistente dentro da gaveta aberta. */
function HostSlot({ host }: { host: HTMLDivElement }) {
  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) node.appendChild(host);
    },
    [host],
  );
  return <div ref={attach} className={FILL_CLASS} />;
}

export function CompactDrawer({
  open,
  onOpenChange,
  side,
  title,
  size = "narrow",
  keepMounted = false,
  showCloseButton = true,
  "data-testid": testId,
  children,
}: CompactDrawerProps) {
  const [host] = useState(() => (keepMounted ? createHost() : null));
  return (
    <>
      {host && createPortal(children, host)}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={side}
          showCloseButton={showCloseButton}
          aria-describedby={undefined}
          data-testid={testId}
          className={`gap-0 p-0 ${SIZE_CLASS[size]} ${side === "left" ? "border-r" : "border-l"}`}
        >
          <SheetTitle className="sr-only">{title}</SheetTitle>
          {host ? (
            <HostSlot host={host} />
          ) : (
            <div className={FILL_CLASS}>{children}</div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
