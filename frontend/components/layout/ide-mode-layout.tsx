"use client";
/* oxlint-disable react/set-state-in-effect -- synchronize layout mode with persisted shell state. */

/**
 * IdeModeLayout — arranjo dos painéis do modo IDE (nav-bar do workbench,
 * conteúdo do workbench, editor e chat).
 *
 * Em viewport wide, os quatro painéis renderizam lado a lado
 * (comportamento inalterado — o caller já cuida de largura/resize de cada
 * um). Em viewport mobile, múltiplos painéis lado a lado não cabem na tela:
 * este componente colapsa para mostrar só o painel ativo por vez, com uma
 * faixa de abas no topo para trocar entre eles — o mesmo padrão de "nav
 * strip + view única montada" que `WorkbenchNavBar`/`WorkbenchContent` já
 * usam para as sub-abas (Arquivos/Diff/Plano/Terminal/etc), aplicado aqui
 * ao nível dos três painéis de topo (Chat/Workbench/Editor).
 */

import { useEffect, useState, type ReactNode } from "react";
import { MessageSquare, PanelsTopLeft, Code2 } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { mDyn } from "@/lib/i18n-dyn";
import { m } from "@/lib/paraglide/messages";
import { ModeColumnLayout } from "@/components/layout/mode-column-layout";
import { WorkbenchHost } from "@/components/layout/workbench-host";
import type { ShellColumnResize } from "@/components/layout/three-column-shell";
import type { IdeLayoutState } from "@/lib/hooks/use-media-query";

export type IdeMobilePanel = "chat" | "workbench" | "editor";

const MOBILE_TABS: { id: IdeMobilePanel; icon: typeof MessageSquare }[] = [
  { id: "chat", icon: MessageSquare },
  { id: "workbench", icon: PanelsTopLeft },
  { id: "editor", icon: Code2 },
];

/** Tablet: editor em largura total, faixa do workbench fixa e gavetas. */
export type IdeResponsiveState = IdeLayoutState | "tablet";

interface IdeModeLayoutProps {
  /** Explicit responsive state. Mobile is reserved for smartphones. */
  layoutState?: IdeResponsiveState;
  /** @deprecated use layoutState; kept for callers migrating from the boolean API. */
  isNarrow?: boolean;
  /** Header do app — vive na coluna central (navBar+workbenchContent+editor),
   * nunca em cima do `chat` (que no modo IDE é a coluna lateral direita). */
  header: ReactNode;
  /** Faixa de ícones das sub-abas do workbench (Arquivos/Diff/Plano/etc). */
  navBar: ReactNode;
  /** Conteúdo da sub-aba ativa do workbench, ou `null` quando o painel está fechado. */
  workbenchContent: ReactNode | null;
  editor: ReactNode;
  chat: ReactNode;
  /** Painel inicial em viewport estreita. Default: "editor". */
  defaultMobilePanel?: IdeMobilePanel;
  /** Estado de visibilidade da workbench, usado para evitar selecionar painel fechado. */
  workbenchOpen?: boolean;
  /** Reabre a workbench quando ela foi fechada no modo compacto. */
  onOpenWorkbench?: () => void;
  /** Fecha a workbench (gaveta do tablet). */
  onCloseWorkbench?: () => void;
  workbenchSide?: "left" | "right";
  direction?: "ltr" | "rtl";
  workbenchWidth?: number;
  workbenchMinWidth?: number;
  workbenchMaxWidth?: number;
  chatWidth?: number;
  chatMinWidth?: number;
  chatMaxWidth?: number;
  workbenchResize?: ShellColumnResize;
  chatResize?: ShellColumnResize;
  /** Keep the chat column mounted while allowing it to collapse to a rail. */
  showChat?: boolean;
  /** Reopens the chat rail after it was collapsed. */
  onOpenChat?: () => void;
}

export function IdeModeLayout({
  layoutState,
  isNarrow = false,
  header,
  navBar,
  workbenchContent,
  editor,
  chat,
  defaultMobilePanel = "editor",
  workbenchOpen = true,
  onOpenWorkbench,
  onCloseWorkbench,
  workbenchSide = "left",
  direction = "ltr",
  workbenchWidth,
  workbenchMinWidth,
  workbenchMaxWidth,
  chatWidth,
  chatMinWidth,
  chatMaxWidth,
  workbenchResize,
  chatResize,
  showChat = true,
  onOpenChat,
}: IdeModeLayoutProps) {
  const resolvedLayoutState = layoutState ?? (isNarrow ? "mobile" : "wide");
  const [mobilePanel, setMobilePanel] =
    useState<IdeMobilePanel>(defaultMobilePanel);
  const [mobileChatMounted, setMobileChatMounted] = useState(
    defaultMobilePanel === "chat",
  );
  const reducedMotion = useReducedMotion();
  const [tabletChatOpen, setTabletChatOpen] = useState(false);
  const [tabletChatMounted, setTabletChatMounted] = useState(false);

  useEffect(() => {
    if (resolvedLayoutState === "tablet" && workbenchOpen) {
      // Só uma gaveta lateral por vez: abrir o workbench fecha o chat.
      setTabletChatOpen(false);
    }
  }, [resolvedLayoutState, workbenchOpen]);

  useEffect(() => {
    if (
      resolvedLayoutState === "mobile" &&
      !workbenchOpen &&
      mobilePanel === "workbench"
    ) {
      setMobilePanel("editor");
    }
  }, [resolvedLayoutState, mobilePanel, workbenchOpen]);

  const tabletDrawerOpen =
    resolvedLayoutState === "tablet" && (workbenchOpen || tabletChatOpen);
  useEffect(() => {
    if (!tabletDrawerOpen) return;
    // Esc fecha a gaveta aberta, como em qualquer painel sobreposto.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setTabletChatOpen(false);
      onCloseWorkbench?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tabletDrawerOpen, onCloseWorkbench]);

  if (resolvedLayoutState === "tablet") {
    const drawerOpen = workbenchOpen || tabletChatOpen;
    const closeDrawers = () => {
      setTabletChatOpen(false);
      onCloseWorkbench?.();
    };
    const workbenchOnLeft = workbenchSide === "left";
    return (
      <div
        className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden"
        data-testid="ide-tablet-layout"
      >
        {header}
        <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
          {workbenchOnLeft && navBar}
          <div className="relative flex-1 min-w-0 min-h-0 overflow-hidden">
            <div className="absolute inset-0 min-w-0 overflow-hidden">
              {editor}
            </div>
            {drawerOpen && (
              <button
                type="button"
                data-testid="ide-tablet-backdrop"
                aria-label={m.workbench_close()}
                onClick={closeDrawers}
                className="absolute inset-0 z-30 cursor-default bg-black/55"
              />
            )}
            <div
              data-testid="ide-tablet-workbench-drawer"
              hidden={!workbenchOpen}
              className={`absolute inset-y-0 z-40 flex min-w-0 w-full overflow-hidden bg-background shadow-xl sm:w-[min(32rem,85%)] ${
                workbenchOnLeft ? "left-0 border-r" : "right-0 border-l"
              }`}
            >
              {workbenchContent}
            </div>
            {tabletChatMounted && (
              <div
                data-testid="ide-tablet-chat-drawer"
                hidden={!tabletChatOpen}
                className="absolute inset-y-0 right-0 z-40 flex min-w-0 w-full overflow-hidden border-l bg-background shadow-xl sm:w-[min(32rem,85%)]"
              >
                {chat}
              </div>
            )}
          </div>
          {!workbenchOnLeft && navBar}
          <nav
            data-testid="ide-tablet-chat-rail"
            aria-label={m.mobile_shell_controls()}
            className="flex w-12 shrink-0 flex-col items-center gap-1 border-l border-border/60 bg-sidebar py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          >
            <button
              type="button"
              data-testid="ide-tablet-chat-toggle"
              aria-label={m.layout_open_chat()}
              title={m.layout_open_chat()}
              aria-pressed={tabletChatOpen}
              onClick={() => {
                if (tabletChatOpen) {
                  setTabletChatOpen(false);
                  return;
                }
                setTabletChatMounted(true);
                onCloseWorkbench?.();
                setTabletChatOpen(true);
              }}
              className={`flex h-7 w-7 pointer-coarse:h-10 pointer-coarse:w-10 items-center justify-center rounded-md transition-colors hover:bg-muted/50 hover:text-foreground ${
                tabletChatOpen
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <MessageSquare className="size-4" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
    );
  }

  if (resolvedLayoutState !== "mobile") {
    return (
      <ModeColumnLayout
        header={header}
        left={
          <WorkbenchHost
            rail={navBar}
            panel={workbenchContent}
            side={workbenchSide}
          />
        }
        center={editor}
        right={chat}
        direction={direction}
        leftColumn={{
          width: workbenchWidth,
          minWidth: workbenchMinWidth,
          maxWidth: workbenchMaxWidth,
          resize: workbenchResize,
        }}
        rightColumn={{
          width: chatWidth,
          minWidth: showChat ? chatMinWidth : 48,
          maxWidth: chatMaxWidth,
          resize: chatResize,
          visibility: showChat ? "visible" : "collapsed",
          onExpand: onOpenChat ?? (() => undefined),
          expandLabel: m.layout_open_chat(),
        }}
      />
    );
  }

  return (
    <div
      className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden"
      data-testid="ide-mobile-layout"
    >
      {header}
      <div
        role="tablist"
        aria-label={mDyn("ide.mobile.tab.workbench")}
        className="flex shrink-0 items-center justify-center gap-1 border-b border-border/60 bg-sidebar px-2 py-1.5"
      >
        {MOBILE_TABS.map(({ id, icon: Icon }) => {
          const active = mobilePanel === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`ide-mobile-tab-${id}`}
              onClick={() => {
                if (id === "chat") setMobileChatMounted(true);
                if (id === "workbench" && !workbenchOpen) {
                  onOpenWorkbench?.();
                }
                setMobilePanel(id);
              }}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {mDyn(`ide.mobile.tab.${id}`)}
            </button>
          );
        })}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {mobileChatMounted && (
          <div
            hidden={mobilePanel !== "chat"}
            data-motion-disabled={reducedMotion ? "true" : undefined}
            className="absolute inset-0 min-h-0 min-w-0 overflow-hidden transition-opacity duration-150 motion-reduce:transition-none"
          >
            {chat}
          </div>
        )}
        {mobilePanel === "workbench" && (
          <div
            data-motion-disabled={reducedMotion ? "true" : undefined}
            className="absolute inset-0 min-h-0 min-w-0 overflow-hidden transition-opacity duration-150 motion-reduce:transition-none"
          >
            <div className="flex h-full min-w-0">
              {navBar}
              {workbenchContent}
            </div>
          </div>
        )}
        {mobilePanel === "editor" && (
          <div
            data-motion-disabled={reducedMotion ? "true" : undefined}
            className="absolute inset-0 min-h-0 min-w-0 overflow-hidden transition-opacity duration-150 motion-reduce:transition-none"
          >
            {editor}
          </div>
        )}
      </div>
    </div>
  );
}
