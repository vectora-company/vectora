"use client";

import * as React from "react";
import { LayoutGrid } from "lucide-react";

import { m } from "@/lib/paraglide/messages";
import { cn } from "@/lib/utils";
import { LAYOUT_GRID, type LayoutPreset } from "@/lib/layout/window-geometry";

/** Tempo que o painel espera antes de fechar, para dar tempo de chegar nele. */
const CLOSE_DELAY_MS = 150;

const LABELS: Record<LayoutPreset, () => string> = {
  center: () => m.window_layout_center(),
  left: () => m.window_layout_left(),
  right: () => m.window_layout_right(),
  top: () => m.window_layout_top(),
  bottom: () => m.window_layout_bottom(),
  "top-left": () => m.window_layout_top_left(),
  "top-right": () => m.window_layout_top_right(),
  "bottom-left": () => m.window_layout_bottom_left(),
  "bottom-right": () => m.window_layout_bottom_right(),
};

/** Região que o encaixe ocupa, em % do miniatura (esquema desenhado no botão). */
const THUMB: Record<LayoutPreset, string> = {
  center: "left-[25%] top-[25%] h-1/2 w-1/2",
  left: "left-0 top-0 h-full w-1/2",
  right: "right-0 top-0 h-full w-1/2",
  top: "left-0 top-0 h-1/2 w-full",
  bottom: "bottom-0 left-0 h-1/2 w-full",
  "top-left": "left-0 top-0 h-1/2 w-1/2",
  "top-right": "right-0 top-0 h-1/2 w-1/2",
  "bottom-left": "bottom-0 left-0 h-1/2 w-1/2",
  "bottom-right": "bottom-0 right-0 h-1/2 w-1/2",
};

interface WindowLayoutMenuProps {
  onSelect: (preset: LayoutPreset) => void;
  className?: string;
}

/**
 * Botão de layout da janela: ao passar o mouse (ou focar/clicar) abre uma
 * grade 3x3 com os encaixes — cantos, metades e centralizar — como os layouts
 * de encaixe do sistema.
 */
export function WindowLayoutMenu({
  onSelect,
  className,
}: WindowLayoutMenuProps) {
  const [open, setOpen] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = () => {
    clearTimeout(timer.current);
    setOpen(true);
  };
  const hideSoon = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };
  React.useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div
      className="relative"
      onMouseEnter={show}
      onMouseLeave={hideSoon}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-label={m.window_layout()}
        title={m.window_layout()}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={className}
      >
        <LayoutGrid />
      </button>
      {open && (
        <div
          role="group"
          aria-label={m.window_layout()}
          data-testid="window-layout-panel"
          className="absolute top-full right-0 z-30 mt-1 grid grid-cols-3 gap-1 rounded-md border bg-popover p-1.5 shadow-lg"
        >
          {LAYOUT_GRID.map((preset) => (
            <button
              key={preset}
              type="button"
              data-testid={`window-layout-${preset}`}
              aria-label={LABELS[preset]()}
              title={LABELS[preset]()}
              onClick={() => {
                onSelect(preset);
                setOpen(false);
              }}
              className="group relative h-6 w-9 rounded-xs border border-border/70 bg-muted/40 hover:border-primary focus-visible:border-primary focus-visible:outline-hidden"
            >
              <span
                className={cn(
                  "absolute rounded-[2px] bg-muted-foreground/50 group-hover:bg-primary group-focus-visible:bg-primary",
                  THUMB[preset],
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
