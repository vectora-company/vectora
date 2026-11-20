"use client";

/**
 * Titlebar customizada do app desktop (Electron, `frame: false` — ver
 * electron/src/main.ts). Invisível no browser puro (window.vectora ausente).
 *
 * Estilo VS Code: usa o bg da sidebar, região arrastável no meio, e os
 * controles nativos (min/max/close) desenhados aqui já que o SO não os
 * fornece mais sem frame. Voltar/recarregar ficam à esquerda porque
 * refletem navegação da SPA, não da janela do SO.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { useRouter } from "@tanstack/react-router";
import { ArrowLeft, RotateCw, Minus, Square, Copy, X } from "lucide-react";
import { m } from "@/lib/paraglide/messages";
import { TITLEBAR_HEIGHT_VAR } from "@/lib/layout/viewport";

function isDesktop(): boolean {
  return (
    typeof window !== "undefined" && Boolean(window.vectora?.windowControls)
  );
}

// `WebkitAppRegion` (drag/no-drag) é específico do Chromium/Electron —
// `CSSProperties` do React não o declara, então tipamos à parte.
const dragRegion: CSSProperties = {
  WebkitAppRegion: "drag",
  // Diálogos modais (Radix) desligam o ponteiro fora deles; a barra de título
  // continua utilizável (maximizar, minimizar, fechar) com eles abertos.
  pointerEvents: "auto",
} as CSSProperties;
const noDragRegion: CSSProperties = {
  WebkitAppRegion: "no-drag",
} as CSSProperties;

export function TitleBar() {
  const router = useRouter();
  const [maximized, setMaximized] = useState(false);
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    // `window` só existe no cliente — detecção do Electron não pode
    // acontecer durante o render (SSR/hidratação).
    // oxlint-disable-next-line react/set-state-in-effect
    setDesktop(isDesktop());
  }, []);

  useEffect(() => {
    // Checa `window.vectora?.windowControls` diretamente — independe do
    // state `desktop` (que só controla o early-return abaixo), por isso
    // roda uma única vez ao montar.
    const controls = window.vectora?.windowControls;
    if (!controls) return;
    controls
      .isMaximized()
      .then(setMaximized)
      .catch(() => undefined);
    const unsubscribe = controls.onStateChange((state) =>
      setMaximized(state.maximized),
    );
    return unsubscribe;
  }, []);

  const barRef = useRef<HTMLDivElement>(null);

  // Publica a altura da barra: overlays e janelas flutuantes começam abaixo dela.
  useEffect(() => {
    if (!desktop) return undefined;
    const root = document.documentElement;
    root.style.setProperty(
      TITLEBAR_HEIGHT_VAR,
      `${barRef.current?.offsetHeight ?? 36}px`,
    );
    return () => {
      root.style.removeProperty(TITLEBAR_HEIGHT_VAR);
    };
  }, [desktop]);

  if (!desktop) return null;

  const controls = window.vectora!.windowControls!;

  return (
    <div
      ref={barRef}
      data-titlebar
      className="relative z-[200] flex h-9 shrink-0 items-center justify-between bg-sidebar text-sidebar-foreground select-none"
      style={dragRegion}
    >
      <div
        className="flex h-full items-center gap-0.5 px-2"
        style={noDragRegion}
      >
        <button
          type="button"
          aria-label={m.titlebar_back()}
          title={m.titlebar_back()}
          disabled={!router.history.canGoBack()}
          onClick={() => router.history.back()}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label={m.titlebar_reload()}
          title={m.titlebar_reload()}
          onClick={() => window.location.reload()}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-white/10 transition-colors"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>

        {/* Ícone+título movidos pra cá do Header (que fica visualmente mais
            enxuto no desktop) — mesma escala dos botões de navegação ao
            lado (h-3.5/h-6), não o tamanho maior usado no Header web. */}
        <div className="flex items-center gap-1.5 pl-1.5 ml-1 border-l border-white/10">
          <Image
            src="/vectora.svg"
            alt=""
            width={18}
            height={18}
            className="h-[18px] w-[18px] shrink-0"
          />
          <span className="text-xs font-medium tracking-tight text-sidebar-foreground/90">
            Vectora
          </span>
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex h-full items-stretch" style={noDragRegion}>
        <button
          type="button"
          aria-label={m.titlebar_minimize()}
          title={m.titlebar_minimize()}
          onClick={() => controls.minimize()}
          className="flex w-11 items-center justify-center hover:bg-white/10 transition-colors"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label={maximized ? m.titlebar_restore() : m.titlebar_maximize()}
          title={maximized ? m.titlebar_restore() : m.titlebar_maximize()}
          onClick={() => controls.maximizeToggle()}
          className="flex w-11 items-center justify-center hover:bg-white/10 transition-colors"
        >
          {maximized ? (
            <Copy className="h-3 w-3 -scale-x-100" />
          ) : (
            <Square className="h-3 w-3" />
          )}
        </button>
        <button
          type="button"
          aria-label={m.titlebar_close()}
          title={m.titlebar_close()}
          onClick={() => controls.close()}
          className="flex w-11 items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
