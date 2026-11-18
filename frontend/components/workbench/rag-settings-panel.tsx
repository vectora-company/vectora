"use client";

/**
 * RagSettingsPanel — gear + painel de configuração do RAG na aba de memória.
 *
 * Controla (persistido no backend via /rag/settings): reranker on/off + top_k,
 * tipos de arquivo a ingerir. Modelos de IA ficam na tela IA Models. Lista as coleções
 * (/rag/collections) com botão de apagar. Caso de uso paralelo ao Context Graph:
 * usar o RAG para código enquanto o grafo cuida dos markdowns.
 *
 * `useRagSettings` centraliza o estado; `RagSettingsButton` (gatilho inline,
 * ex.: ao lado da busca) e `RagSettingsSlidePanel` (conteúdo modal)
 * são exportados separados para o consumidor controlar onde cada um entra no
 * layout — o painel precisa ocupar a largura total da workbench numa linha
 * própria abaixo do gatilho, nunca dividir espaço com ele na mesma linha
 * flex (senão o conteúdo do formulário força a linha a estourar a largura).
 * `RagSettingsPanel` compõe os dois com o hook embutido, para uso standalone.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Settings2, Trash2, RefreshCw } from "lucide-react";

import {
  ALL_GRAPH_FILE_TYPES,
  type GraphFileType,
} from "@/lib/stores/context-graph-settings-store";
import { useToastStore } from "@/lib/stores/toast-store";
import { WorkbenchDialog } from "@/components/workbench/workbench-dialog";
import { m } from "@/lib/paraglide/messages";

interface RagSettings {
  reranker_enabled: boolean;
  reranker_top_k: number;
  rerank_model: string;
  embed_model: string;
  ingest_file_types: string[];
}

interface Collection {
  name: string;
  count: number | null;
}

const DEFAULTS: RagSettings = {
  reranker_enabled: true,
  reranker_top_k: 5,
  rerank_model: "",
  embed_model: "",
  ingest_file_types: [],
};

export function useRagSettings({
  autoLoad = false,
}: { autoLoad?: boolean } = {}) {
  const [open, setOpen] = useState(autoLoad);
  const [settings, setSettings] = useState<RagSettings>(DEFAULTS);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [settingsStatus, setSettingsStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [collectionsStatus, setCollectionsStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [patching, setPatching] = useState(false);
  const collectionRequestRef = useRef(0);
  const collectionGenerationRef = useRef(0);
  const patchQueueRef = useRef<Promise<void>>(Promise.resolve());
  const settingsRef = useRef(settings);
  const pendingPatchesRef = useRef(0);
  const pendingDeleteRef = useRef<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const loadCollections = useCallback(async () => {
    const requestId = ++collectionRequestRef.current;
    const generation = collectionGenerationRef.current;
    setCollectionsStatus("loading");
    try {
      const res = await fetch("/rag/collections");
      if (requestId !== collectionRequestRef.current) return;
      if (!res.ok) {
        setCollectionsStatus("error");
        return;
      }
      const data = (await res.json()) as { collections?: Collection[] };
      if (generation !== collectionGenerationRef.current) return;
      setCollections(Array.isArray(data.collections) ? data.collections : []);
      setCollectionsStatus("ready");
    } catch {
      setCollectionsStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/rag/settings");
        if (res.ok && alive) {
          const data = (await res.json()) as Partial<RagSettings>;
          const next = { ...DEFAULTS, ...data };
          settingsRef.current = next;
          setSettings(next);
          setSettingsStatus("ready");
        } else if (alive) {
          setSettingsStatus("error");
        }
      } catch {
        if (alive) setSettingsStatus("error");
      }
    })();
    // Busca coleções RAG no backend (rede) ao abrir o painel, não estado derivado.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadCollections();
    return () => {
      alive = false;
    };
  }, [open, loadCollections]);

  const patch = useCallback((changes: Partial<RagSettings>) => {
    pendingPatchesRef.current += 1;
    setPatching(true);
    const run = async () => {
      const previous = settingsRef.current;
      const optimistic = { ...previous, ...changes };
      settingsRef.current = optimistic;
      setSettings(optimistic);
      try {
        const res = await fetch("/rag/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        });
        if (res.ok) {
          const data = (await res.json()) as RagSettings;
          const next = { ...DEFAULTS, ...data };
          settingsRef.current = next;
          setSettings(next);
          return;
        }
        settingsRef.current = previous;
        setSettings(previous);
        useToastStore.getState().error(m.workbench_settings_error());
      } catch {
        settingsRef.current = previous;
        setSettings(previous);
        useToastStore.getState().error(m.workbench_settings_error());
      } finally {
        pendingPatchesRef.current -= 1;
        if (pendingPatchesRef.current === 0) setPatching(false);
      }
    };
    const queued = patchQueueRef.current.then(run, run);
    patchQueueRef.current = queued.catch(() => undefined);
    return queued;
  }, []);

  const deleteCollection = useCallback(async (name: string) => {
    if (!window.confirm(m.rag_collection_delete_confirm({ name }))) return;
    if (pendingDeleteRef.current === name) return;
    pendingDeleteRef.current = name;
    setPendingDelete(name);
    try {
      const res = await fetch(`/rag/collections/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        collectionGenerationRef.current += 1;
        setCollections((c) => c.filter((x) => x.name !== name));
      } else {
        useToastStore.getState().error(m.rag_collection_delete());
      }
    } catch {
      useToastStore.getState().error(m.rag_collection_delete());
    } finally {
      pendingDeleteRef.current = null;
      setPendingDelete(null);
    }
  }, []);

  return {
    open,
    toggle: () => setOpen((v) => !v),
    close: () => setOpen(false),
    settings,
    settingsStatus,
    collectionsStatus,
    patching,
    collections,
    patch,
    loadCollections,
    deleteCollection,
    pendingDelete,
  };
}

type RagSettingsState = ReturnType<typeof useRagSettings>;

export function RagSettingsButton({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      aria-label={m.rag_settings_title()}
      title={m.rag_settings_title()}
      aria-expanded={open}
      data-testid="rag-settings-btn"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted/50 hover:text-foreground"
    >
      <Settings2 className="h-3.5 w-3.5" />
    </button>
  );
}

export function RagSettingsForm({
  open,
  close,
  settings,
  collections,
  patch,
  loadCollections,
  deleteCollection,
  pendingDelete,
  settingsStatus,
  collectionsStatus,
  patching,
  includeIngestionSettings = true,
  includeCollections = true,
}: Pick<
  RagSettingsState,
  | "open"
  | "close"
  | "settings"
  | "collections"
  | "patch"
  | "loadCollections"
  | "deleteCollection"
  | "pendingDelete"
  | "settingsStatus"
  | "collectionsStatus"
  | "patching"
> & {
  includeIngestionSettings?: boolean;
  includeCollections?: boolean;
}) {
  if (settingsStatus === "loading" || settingsStatus === "idle") {
    return (
      <p className="p-4 text-xs text-muted-foreground">
        {m.workbench_settings_loading()}
      </p>
    );
  }
  if (settingsStatus === "error") {
    return (
      <p className="p-4 text-xs text-destructive">
        {m.workbench_settings_error()}
      </p>
    );
  }
  return (
    <div className="min-w-0 space-y-3 text-xs" aria-busy={patching}>
      {/* Tipos de arquivo a ingerir */}
      {includeIngestionSettings && (
        <div>
          <p className="font-medium text-foreground">
            {m.graph_settings_filetypes()}
          </p>
          <div className="mt-1 space-y-1">
            {ALL_GRAPH_FILE_TYPES.map((t: GraphFileType) => (
              <label
                key={t}
                className="flex items-center gap-2 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={
                    settings.ingest_file_types.length === 0 ||
                    settings.ingest_file_types.includes(t)
                  }
                  onChange={() => {
                    const cur =
                      settings.ingest_file_types.length === 0
                        ? [...ALL_GRAPH_FILE_TYPES]
                        : settings.ingest_file_types;
                    const next = cur.includes(t)
                      ? cur.filter((x) => x !== t)
                      : [...cur, t];
                    void patch({ ingest_file_types: next });
                  }}
                  className="accent-[var(--color-primary)]"
                />
                <span className="text-foreground">
                  {t === "code"
                    ? m.graph_filetype_code()
                    : t === "document"
                      ? m.graph_filetype_document()
                      : m.graph_filetype_paper()}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Coleções */}
      {includeCollections && (
        <div className="border-t border-border/60 pt-2">
          <div className="flex items-center justify-between">
            <p className="font-medium text-foreground">
              {m.rag_collections_title()}
            </p>
            <button
              onClick={() => void loadCollections()}
              aria-label={m.workbench_files_refresh()}
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
          {collectionsStatus === "loading" ? (
            <p className="mt-1 text-[10px] text-muted-foreground">
              {m.workbench_settings_loading()}
            </p>
          ) : collectionsStatus === "error" ? (
            <p className="mt-1 text-[10px] text-destructive">
              {m.workbench_settings_error()}
            </p>
          ) : collections.length === 0 ? (
            <p className="mt-1 text-[10px] text-muted-foreground">
              {m.rag_collections_empty()}
            </p>
          ) : (
            <ul className="mt-1 space-y-1">
              {collections.map((c) => (
                <li
                  key={c.name}
                  className="flex items-center justify-between gap-2 rounded border border-border/60 px-2 py-1"
                >
                  <span className="min-w-0 truncate text-foreground">
                    {c.name}
                    {c.count != null && (
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        {m.rag_collection_count({ n: c.count })}
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => void deleteCollection(c.name)}
                    disabled={pendingDelete === c.name}
                    aria-label={m.rag_collection_delete()}
                    title={m.rag_collection_delete()}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function RagSettingsSlidePanel(
  props: Pick<
    RagSettingsState,
    | "open"
    | "close"
    | "settings"
    | "collections"
    | "patch"
    | "loadCollections"
    | "deleteCollection"
  >,
) {
  const formProps = {
    ...props,
    settingsStatus: "ready" as const,
    collectionsStatus: "ready" as const,
    patching: false,
    pendingDelete: null,
  };
  return (
    <WorkbenchDialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) props.close();
      }}
      title={m.rag_settings_title()}
      description={m.rag_settings_title()}
      testId="rag-settings-panel"
    >
      <RagSettingsForm {...formProps} />
    </WorkbenchDialog>
  );
}

/** Composição standalone (botão + painel juntos) — para uso fora de layouts
 * que precisem posicionar os dois em linhas separadas (ver `MemoryTab`). */
export function RagSettingsPanel() {
  const state = useRagSettings();
  return (
    <>
      <RagSettingsButton open={state.open} onToggle={state.toggle} />
      <RagSettingsSlidePanel {...state} />
    </>
  );
}
