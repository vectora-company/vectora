"use client";

import { useEffect, useRef, useState } from "react";
import { m } from "@/lib/paraglide/messages";
import {
  contributionPageUrl,
  type ExtensionContribution,
} from "@/lib/extensions/registry";

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 4000;

/** Mensagens que a página da extensão pode mandar ao app. Tudo o mais é ignorado. */
export function parseFrameMessage(
  data: unknown,
): { type: "ready" } | { type: "resize"; height: number } | null {
  if (typeof data !== "object" || data === null) return null;
  const message = data as Record<string, unknown>;
  if (message.type === "vectora.ready") return { type: "ready" };
  if (message.type === "vectora.resize") {
    const height = Number(message.height);
    if (!Number.isFinite(height)) return null;
    return {
      type: "resize",
      height: Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(height))),
    };
  }
  return null;
}

/**
 * Página de extensão em iframe isolado: `sandbox="allow-scripts"` dá origem
 * opaca, então ela não lê cookies, stores nem DOM do app. A única ponte é a
 * mensagem filtrada por `parseFrameMessage`, vinda deste mesmo iframe.
 */
export function ExtensionFrame({
  contribution,
  fill = true,
}: {
  contribution: ExtensionContribution;
  fill?: boolean;
}) {
  const url = contributionPageUrl(contribution);
  if (!url) {
    return (
      <div role="alert" className="p-4 text-sm text-muted-foreground">
        {m.extensions_frame_unavailable()}
      </div>
    );
  }
  // `key` recomeça o estado (carregando e altura) quando a página muda.
  return (
    <FramePage key={url} url={url} title={contribution.label} fill={fill} />
  );
}

function FramePage({
  url,
  title,
  fill,
}: {
  url: string;
  title: string;
  fill: boolean;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow) return;
      const message = parseFrameMessage(event.data);
      if (message?.type === "ready") setReady(true);
      if (message?.type === "resize") setHeight(message.height);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div className={fill ? "relative h-full w-full" : "relative w-full"}>
      {!ready && (
        <div
          role="status"
          className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground"
        >
          {m.extensions_frame_loading()}
        </div>
      )}
      <iframe
        ref={frameRef}
        title={title}
        src={url}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        className="h-full w-full border-0 bg-background"
        style={height && !fill ? { height } : undefined}
        onLoad={() => setReady(true)}
      />
    </div>
  );
}
