"use client";

import * as React from "react";
import { LayoutGrid } from "lucide-react";

import { m } from "@/lib/paraglide/messages";
import {
  LAYOUT_TEMPLATES,
  type LayoutTarget,
} from "@/lib/layout/window-geometry";

/** Tempo que o painel espera antes de fechar, para dar tempo de chegar nele. */
const CLOSE_DELAY_MS = 150;

const ZONE_LABELS: Record<string, () => string> = {
  left: () => m.window_layout_left(),
  right: () => m.window_layout_right(),
  "left-wide": () => m.window_layout_left_wide(),
  "right-narrow": () => m.window_layout_right_narrow(),
  "third-left": () => m.window_layout_third_left(),
  "third-center": () => m.window_layout_third_center(),
  "third-right": () => m.window_layout_third_right(),
  "top-left": () => m.window_layout_top_left(),
  "top-right": () => m.window_layout_top_right(),
  "bottom-left": () => m.window_layout_bottom_left(),
  "bottom-right": () => m.window_layout_bottom_right(),
};

interface WindowLayoutMenuProps {
  onSelect: (target: LayoutTarget) => void;
  className?: string;
}

/**
 * Botão de layout da janela, no estilo dos layouts de encaixe do Windows 11:
 * ao passar o mouse (ou focar/clicar) abre um painel com poucos modelos de
 * divisão desenhados; a zona sob o mouse acende e clicar nela encaixa a
 * janela ali. Um botão extra centraliza.
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

  const choose = (target: LayoutTarget) => {
    onSelect(target);
    setOpen(false);
  };

  return (
    // z-index alto: o painel precisa ficar acima do editor (minimap, rolagem).
    <div
      className="relative z-[1000]"
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
          className="absolute top-full right-0 mt-2 w-max rounded-lg border bg-popover p-2.5 text-popover-foreground shadow-xl"
        >
          <div className="grid grid-cols-2 gap-2.5">
            {LAYOUT_TEMPLATES.map((template) => (
              <div
                key={template.id}
                data-testid={`window-layout-template-${template.id}`}
                className="relative h-14 w-24 rounded-md border border-border/70 bg-muted/30 p-0.5"
              >
                <div className="relative h-full w-full">
                  {template.zones.map((zone) => (
                    <div
                      key={zone.id}
                      className="absolute p-px"
                      style={{
                        left: `${zone.x * 100}%`,
                        top: `${zone.y * 100}%`,
                        width: `${zone.w * 100}%`,
                        height: `${zone.h * 100}%`,
                      }}
                    >
                      <button
                        type="button"
                        data-testid={`window-layout-zone-${zone.id}`}
                        aria-label={ZONE_LABELS[zone.id]?.() ?? zone.id}
                        onClick={() => choose(zone)}
                        className="block h-full w-full rounded-[3px] bg-muted-foreground/30 transition-colors hover:bg-primary focus-visible:bg-primary focus-visible:outline-hidden"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            data-testid="window-layout-center"
            onClick={() => choose("center")}
            className="mt-2.5 w-full rounded-md px-2 py-1 text-center text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:outline-hidden"
          >
            {m.window_layout_center()}
          </button>
        </div>
      )}
    </div>
  );
}
