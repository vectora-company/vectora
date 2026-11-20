import { useEffect, useState } from "react";

/**
 * Reage a uma media query via `matchMedia`, com valor inicial síncrono
 * (evita flash — o listener só cobre mudanças pós-mount, ex: resize da
 * janela ou rotação do dispositivo).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    // Sincroniza com o sistema externo matchMedia — o valor pode ter mudado
    // entre o cálculo síncrono do useState e o efeito rodar.
    // oxlint-disable-next-line react/set-state-in-effect
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/** Breakpoint `md` do Tailwind (768px) — abaixo dele, layouts multi-painel
 * colapsam para um único painel visível por vez. */
export const MD_BREAKPOINT_QUERY = "(max-width: 767px)";

export function useIsNarrowViewport(): boolean {
  return useMediaQuery(MD_BREAKPOINT_QUERY);
}

/**
 * Returns the unscaled window width used for responsive layout decisions.
 *
 * Electron's appearance scale is implemented with `webContents.setZoomLevel`.
 * That changes CSS pixels and therefore `innerWidth`/`matchMedia`, even though
 * the physical window is unchanged. `outerWidth` remains the window geometry,
 * so the UI scale can never accidentally switch the IDE into mobile layout.
 */
export function getUnscaledViewportWidth(): number {
  if (typeof window === "undefined") return Number.POSITIVE_INFINITY;
  const isElectron = Boolean(window.vectora?.windowControls);
  if (isElectron && window.outerWidth > 0) return window.outerWidth;
  return window.visualViewport?.width ?? window.innerWidth;
}

/** Tailwind `sm` breakpoint: below 640px is the smartphone layout. */
export const IDE_COMPACT_BREAKPOINT = 640;

/** Tablets and narrow desktop windows use one overlay sidebar at a time. */
export const SESSION_COMPACT_BREAKPOINT = 1100;
export type SessionLayoutState = "compact" | "wide";

export function getSessionLayoutState(width: number): SessionLayoutState {
  if (width < SESSION_COMPACT_BREAKPOINT) return "compact";
  return "wide";
}

/**
 * Reads the physical viewport and updates on resize/rotation. The first render
 * already uses the real width: starting as "wide" and correcting after mount
 * painted the desktop shell (with its third column) for one frame on narrow
 * windows.
 */
export function useSessionLayoutState(): SessionLayoutState {
  const [state, setState] = useState<SessionLayoutState>(() =>
    getSessionLayoutState(getUnscaledViewportWidth()),
  );

  useEffect(() => {
    const update = () =>
      setState(getSessionLayoutState(getUnscaledViewportWidth()));
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  return state;
}

export type IdeLayoutState = "wide" | "mobile";

/** Classifies the IDE from the unscaled window geometry. */
export function getIdeLayoutState(width: number): IdeLayoutState {
  if (width < IDE_COMPACT_BREAKPOINT) return "mobile";
  return "wide";
}

export function useIdeLayoutState(): IdeLayoutState {
  // The app is a client-only SPA, so the real unscaled window geometry can be
  // read on the first render; correcting it after mount flashed the wide IDE
  // (and remounted the chat) before switching to the mobile layout.
  const [state, setState] = useState<IdeLayoutState>(() =>
    getIdeLayoutState(getUnscaledViewportWidth()),
  );

  useEffect(() => {
    const update = () =>
      setState(getIdeLayoutState(getUnscaledViewportWidth()));
    // oxlint-disable-next-line react/set-state-in-effect
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return state;
}

/** Whether the IDE should use its smartphone-only mobile layout. */
export function useIsNarrowIdeViewport(): boolean {
  return useIdeLayoutState() === "mobile";
}
