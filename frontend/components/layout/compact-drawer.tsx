"use client";

import {
  useCallback,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  getPanelWidthFromPointer,
  getResizeDelta,
} from "@/lib/layout/resize-geometry";
import { m } from "@/lib/paraglide/messages";

/**
 * Gaveta única das colunas laterais do shell no modo compacto.
 *
 * Sessões, workbench e o chat do IDE abrem do mesmo jeito: um Sheet com o fundo
 * escuro, foco e Esc do Radix, por cima de tudo (header e composer incluídos) e
 * com o conteúdo da própria coluna, igual ao do layout largo. A faixa estreita
 * que fica no shell só abre e fecha a gaveta. A largura se arrasta pela borda
 * interna (ou pelas setas) e fica guardada por gaveta.
 */
type CompactDrawerSize = "narrow" | "wide";

const DEFAULT_WIDTH: Record<CompactDrawerSize, number> = {
  narrow: 288,
  wide: 512,
};
const MIN_WIDTH: Record<CompactDrawerSize, number> = {
  narrow: 240,
  wide: 320,
};
/** Sobra sempre uma faixa do app à vista, para a gaveta nunca virar tela cheia. */
const VIEWPORT_MARGIN = 48;
const MAX_WIDTH = 960;
const KEY_STEP = 16;
const STORAGE_PREFIX = "vectora.compact-drawer.";

function clampWidth(width: number, size: CompactDrawerSize): number {
  const viewport =
    typeof window === "undefined"
      ? MAX_WIDTH + VIEWPORT_MARGIN
      : window.innerWidth;
  const max = Math.max(
    MIN_WIDTH[size],
    Math.min(MAX_WIDTH, viewport - VIEWPORT_MARGIN),
  );
  return Math.round(Math.min(max, Math.max(MIN_WIDTH[size], width)));
}

function readStoredWidth(id: string, size: CompactDrawerSize): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + id);
    const parsed = raw === null ? NaN : Number(raw);
    if (Number.isFinite(parsed)) return clampWidth(parsed, size);
  } catch {
    // Sem armazenamento (modo privado, bloqueado): usa o padrão.
  }
  return clampWidth(DEFAULT_WIDTH[size], size);
}

function storeWidth(id: string, width: number): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + id, String(width));
  } catch {
    // A largura simplesmente não persiste.
  }
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

interface CompactDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: "left" | "right";
  /** Nome acessível da gaveta (leitores de tela). */
  title: string;
  /** Identifica a gaveta para guardar a largura que o usuário escolheu. */
  resizeId: string;
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

export function CompactDrawer({
  open,
  onOpenChange,
  side,
  title,
  resizeId,
  size = "narrow",
  keepMounted = false,
  showCloseButton = true,
  "data-testid": testId,
  children,
}: CompactDrawerProps) {
  const [host] = useState(() => (keepMounted ? createHost() : null));
  const [width, setWidth] = useState(() => readStoredWidth(resizeId, size));
  const [dragging, setDragging] = useState(false);

  const commit = useCallback(
    (next: number) => {
      const clamped = clampWidth(next, size);
      setWidth(clamped);
      return clamped;
    },
    [size],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    // A borda de ancoragem (esquerda numa gaveta da esquerda) não muda no arrasto.
    const anchored =
      side === "left"
        ? { left: 0, right: rect.right }
        : { left: rect.left, right: window.innerWidth };
    commit(getPanelWidthFromPointer(event.clientX, anchored, side));
  };
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setDragging(false);
    storeWidth(resizeId, width);
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Home") {
      event.preventDefault();
      storeWidth(resizeId, commit(MIN_WIDTH[size]));
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    storeWidth(
      resizeId,
      commit(width + getResizeDelta(event.key, side, KEY_STEP)),
    );
  };
  const reset = () => storeWidth(resizeId, commit(DEFAULT_WIDTH[size]));

  return (
    <>
      {host && createPortal(children, host)}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={side}
          showCloseButton={showCloseButton}
          aria-describedby={undefined}
          data-testid={testId}
          data-side={side}
          data-resizing={dragging ? "true" : undefined}
          style={{ width, maxWidth: `calc(100vw - ${VIEWPORT_MARGIN}px)` }}
          className={`compact-drawer gap-0 p-0 ${side === "left" ? "border-r" : "border-l"}`}
        >
          <SheetTitle className="sr-only">{title}</SheetTitle>
          {host ? (
            <HostSlot host={host} />
          ) : (
            <div className={FILL_CLASS}>{children}</div>
          )}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={m.resize_drawer()}
            aria-valuemin={MIN_WIDTH[size]}
            aria-valuemax={MAX_WIDTH}
            aria-valuenow={width}
            tabIndex={0}
            data-testid="compact-drawer-resize"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={onKeyDown}
            onDoubleClick={reset}
            className={`absolute inset-y-0 z-10 w-1.5 cursor-col-resize touch-none bg-transparent transition-colors hover:bg-primary/30 focus-visible:bg-primary/40 focus-visible:outline-none data-[dragging=true]:bg-primary/40 ${side === "left" ? "right-0" : "left-0"}`}
            data-dragging={dragging ? "true" : undefined}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
