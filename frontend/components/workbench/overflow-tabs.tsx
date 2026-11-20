"use client";

/**
 * Linha de abas que, quando não cabe, manda as últimas para um menu "Mais"
 * (como no GitHub Desktop). A aba ativa nunca fica escondida. A medida vem de
 * uma cópia invisível das abas, então o menu só aparece se for preciso.
 */

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fitTabs, type FitTabsResult } from "@/lib/layout/fit-tabs";
import { m } from "@/lib/paraglide/messages";
import { cn } from "@/lib/utils";

export interface OverflowTab {
  id: string;
  label: ReactNode;
  /** Número exibido ao lado do rótulo (ex.: arquivos alterados); 0/undefined esconde. */
  badge?: number;
}

interface OverflowTabsProps {
  tabs: OverflowTab[];
  activeId: string;
  onSelect: (id: string) => void;
  ariaLabel: string;
  className?: string;
}

const TAB_CLASS =
  "shrink-0 whitespace-nowrap px-2.5 py-1.5 text-center text-xs font-medium transition-colors";

function TabContent({ tab }: { tab: OverflowTab }) {
  return (
    <span className="inline-flex items-center gap-1">
      {tab.label}
      {tab.badge ? (
        <span
          data-testid={`tab-badge-${tab.id}`}
          className="rounded-full bg-muted px-1.5 text-[10px] leading-4 text-muted-foreground"
        >
          {tab.badge}
        </span>
      ) : null}
    </span>
  );
}

export function OverflowTabs({
  tabs,
  activeId,
  onSelect,
  ariaLabel,
  className,
}: OverflowTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeIndex = tabs.findIndex((tab) => tab.id === activeId);
  const [fit, setFit] = useState<FitTabsResult>(() => ({
    visible: tabs.map((_, index) => index),
    overflow: [],
  }));

  const recompute = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    // Abas escondidas ficam fora do fluxo, mas mantêm a largura natural.
    const widths = tabs.map(
      (tab) =>
        container.querySelector<HTMLElement>(`[data-tab="${tab.id}"]`)
          ?.offsetWidth ?? 0,
    );
    const moreWidth =
      container.querySelector<HTMLElement>("[data-more]")?.offsetWidth ?? 0;
    const next = fitTabs(widths, container.clientWidth, moreWidth, activeIndex);
    setFit((previous) =>
      previous.visible.join() === next.visible.join() &&
      previous.overflow.join() === next.overflow.join()
        ? previous
        : next,
    );
  }, [activeIndex, tabs]);

  // Recalcula quando as abas (rótulos, contagens) ou a aba ativa mudam...
  useLayoutEffect(() => {
    recompute();
  }, [recompute]);

  // ...e quando a largura disponível muda (redimensionar o painel).
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => recompute());
    observer.observe(container);
    return () => observer.disconnect();
  }, [recompute]);

  const overflowTabs = fit.overflow.map((index) => tabs[index]!);

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "relative flex min-w-0 shrink-0 items-center overflow-hidden border-b border-border/60 px-1",
        className,
      )}
    >
      {tabs.map((tab, index) => {
        const active = tab.id === activeId;
        const shown = fit.visible.includes(index);
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-hidden={shown ? undefined : true}
            tabIndex={shown ? undefined : -1}
            data-tab={tab.id}
            data-testid={`tab-${tab.id}`}
            onClick={() => onSelect(tab.id)}
            className={cn(
              TAB_CLASS,
              // Fora do espaço, mas ainda medível: reaparece se sobrar largura.
              !shown && "pointer-events-none invisible absolute top-0 left-0",
              active
                ? "-mb-px border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <TabContent tab={tab} />
          </button>
        );
      })}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-more
            data-testid="tabs-more"
            aria-hidden={overflowTabs.length > 0 ? undefined : true}
            tabIndex={overflowTabs.length > 0 ? undefined : -1}
            className={cn(
              TAB_CLASS,
              "inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground",
              overflowTabs.length > 0
                ? "ml-auto"
                : "pointer-events-none invisible absolute top-0 left-0",
            )}
          >
            {m.workbench_tabs_more()}
            <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-36">
          {overflowTabs.map((tab) => (
            <DropdownMenuItem
              key={tab.id}
              data-testid={`more-tab-${tab.id}`}
              onSelect={() => onSelect(tab.id)}
              className="text-xs"
            >
              <TabContent tab={tab} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
