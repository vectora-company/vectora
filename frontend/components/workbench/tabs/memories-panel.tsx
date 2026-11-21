"use client";

/**
 * MemoriesPanel — lista e gerencia memórias persistentes do usuário.
 *
 * Funcionalidades:
 * - Lista todas as memórias do usuário (fetch GET /memory)
 * - Adiciona memória manualmente (POST /memory)
 * - Edita conteúdo de uma memória inline (PUT /memory/:key)
 * - Deleta uma memória específica (DELETE /memory/:key)
 * - Limpa todas as memórias (DELETE /memory) com confirmação
 */

import { Brain, Edit2, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ResizableDialogContent } from "@/components/ui/resizable-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspacesStore } from "@/lib/stores/workspaces-store";
import { m } from "@/lib/paraglide/messages";
import { mDyn } from "@/lib/i18n-dyn";
// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
import { settingsItemClass } from "@/components/settings/primitives";
import {
  WorkbenchActions,
  WorkbenchEmpty,
} from "@/components/workbench/primitives";
import { cn } from "@/lib/utils";

interface MemoryItem {
  key: string;
  content: string;
  metadata: Record<string, unknown>;
  updated_at: string;
}

interface ListMemoriesResponse {
  memories: MemoryItem[];
  total: number;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

/** URL do REST de memória com o workspace ativo, para ler o mesmo escopo
 * em que as memory tools do agente gravam. */
function memoryUrl(path: string): string {
  const workspaceId = useWorkspacesStore.getState().getActive()?.id;
  if (!workspaceId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}workspace_id=${encodeURIComponent(workspaceId)}`;
}

async function fetchMemories(
  limit = 50,
  offset = 0,
): Promise<ListMemoriesResponse> {
  const res = await fetch(memoryUrl(`/memory?limit=${limit}&offset=${offset}`));
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

async function updateMemory(key: string, content: string): Promise<void> {
  const res = await fetch(memoryUrl(`/memory/${encodeURIComponent(key)}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
}

async function deleteMemory(key: string): Promise<void> {
  const res = await fetch(memoryUrl(`/memory/${encodeURIComponent(key)}`), {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
}

async function clearAllMemories(): Promise<void> {
  const res = await fetch(memoryUrl(`/memory`), { method: "DELETE" });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
}

async function createMemory(key: string, content: string): Promise<void> {
  const res = await fetch(memoryUrl(`/memory`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, content }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      (data as { detail?: string }).detail ?? `Erro ${res.status}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export interface LearnedSkill {
  id: string;
  name: string;
  description: string;
}

export interface LearnedFact {
  key: string;
  content: string;
}

interface MemoriesPanelProps {
  /**
   * Layout denso da workbench: textos e botões menores, ações numa linha
   * abaixo do resumo e os itens aprendidos (skills e fatos) na mesma lista.
   */
  compact?: boolean;
  /** Skills e fatos aprendidos, mostrados junto das memórias (só no compacto). */
  learned?: { skills: LearnedSkill[]; facts: LearnedFact[] };
}

export function MemoriesPanel({
  compact = false,
  learned,
}: MemoriesPanelProps = {}) {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado de edição
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  // Estado de exclusão
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Estado de criação
  const [addOpen, setAddOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newContent, setNewContent] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMemories();
      // Resposta sem a lista (backend antigo ou falha parcial) vale como vazia.
      setMemories(data.memories ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError(m.memory_error_load());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Carrega memórias do backend ao montar, não estado derivado.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  const handleEditStart = (mem: MemoryItem) => {
    setEditingKey(mem.key);
    setEditContent(mem.content);
  };

  const handleEditSave = async () => {
    if (!editingKey) return;
    setSaving(true);
    try {
      await updateMemory(editingKey, editContent);
      setMemories((prev) =>
        prev.map((item) =>
          item.key === editingKey ? { ...item, content: editContent } : item,
        ),
      );
      setEditingKey(null);
    } catch {
      setError(m.memory_error_save());
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (key: string) => {
    setDeletingKey(key);
    try {
      await deleteMemory(key);
      setMemories((prev) => prev.filter((item) => item.key !== key));
      setTotal((prev) => prev - 1);
    } catch {
      setError(m.memory_error_delete());
    } finally {
      setDeletingKey(null);
    }
  };

  const handleAddMemory = async () => {
    if (!newContent.trim()) return;
    // A memória é global para o usuário e o rótulo é opcional: sem ele, a chave
    // é gerada aqui.
    const key =
      newKey.trim() ||
      `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setAdding(true);
    try {
      await createMemory(key, newContent.trim());
      await load();
      setAddOpen(false);
      setNewKey("");
      setNewContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : m.memory_error_create());
    } finally {
      setAdding(false);
    }
  };

  const handleClearAll = async () => {
    setClearing(true);
    try {
      await clearAllMemories();
      setMemories([]);
      setTotal(0);
      setClearConfirmOpen(false);
    } catch {
      setError(m.memory_error_clear());
    } finally {
      setClearing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const headerTitle =
    total > 0
      ? mDyn(total === 1 ? "memory.count_one" : "memory.count_many", {
          n: total,
        })
      : m.memory_empty_title();

  // Fatos já listados como memória não se repetem; só entra o que falta.
  const memoryKeys = new Set(memories.map((item) => item.key));
  const extraFacts = (learned?.facts ?? []).filter(
    (fact) => !memoryKeys.has(fact.key),
  );
  const extraSkills = learned?.skills ?? [];
  const hasExtras = extraFacts.length + extraSkills.length > 0;
  const nothingToShow = memories.length === 0 && !hasExtras;

  // Tamanhos: no layout denso usam-se as variações menores do tema.
  const actionSize = compact ? "xs" : "sm";
  const iconClass = compact ? "" : "w-3.5 h-3.5 mr-1.5";
  const cardClass = compact
    ? "space-y-1.5 rounded-lg border border-border/60 bg-card/30 px-2.5 py-2"
    : cn(settingsItemClass, "space-y-2 p-3");
  const bodyTextClass = compact
    ? "text-xs text-foreground line-clamp-3"
    : "text-sm text-foreground/90 line-clamp-3";

  const actions = (
    <WorkbenchActions testId="memory-actions">
      <Button
        variant="outline"
        size={actionSize}
        onClick={() => setAddOpen(true)}
      >
        <Plus className={iconClass} />
        {m.memory_add()}
      </Button>
      {memories.length > 0 && (
        <Button
          variant="outline"
          size={actionSize}
          className="text-destructive hover:text-destructive dark:hover:text-destructive"
          onClick={() => setClearConfirmOpen(true)}
        >
          <Trash2 className={iconClass} />
          {m.memory_clear_all()}
        </Button>
      )}
    </WorkbenchActions>
  );

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      {/* Resumo e, numa linha abaixo, as ações */}
      <div
        className={
          compact ? "space-y-1.5" : "flex items-center justify-between"
        }
      >
        <div className="space-y-0.5">
          <p
            className={compact ? "text-xs font-medium" : "text-sm font-medium"}
          >
            {headerTitle}
          </p>
          <p
            className={
              compact
                ? "text-[10px] text-muted-foreground"
                : "text-xs text-muted-foreground"
            }
          >
            {m.memory_subtitle()}
          </p>
        </div>
        {actions}
      </div>

      {/* Erro */}
      {error && (
        <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {error}
        </p>
      )}

      {/* Empty state: um só, no lugar de vários textos repetidos */}
      {nothingToShow &&
        !loading &&
        (compact ? (
          <WorkbenchEmpty compact>
            {m.workbench_memory_journey_empty()}
          </WorkbenchEmpty>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
            <Brain className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {m.memory_empty_hint()}
            </p>
            <p className="text-xs text-muted-foreground/70 max-w-[260px]">
              {m.memory_empty_hint2()}
            </p>
          </div>
        ))}

      {/* Lista: memórias salvas + skills e fatos aprendidos, tudo junto */}
      <div className={compact ? "space-y-1.5" : "space-y-2"}>
        {memories.map((mem) => (
          <div key={mem.key} className={cardClass}>
            {/* Key + data */}
            <div className="flex items-start justify-between gap-2">
              <span
                className={cn(
                  "font-mono text-muted-foreground truncate",
                  compact ? "text-[10px]" : "text-xs",
                )}
              >
                {mem.key}
              </span>
              {mem.updated_at && (
                <span className="text-2xs text-muted-foreground/60 shrink-0">
                  {new Date(mem.updated_at).toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>

            {/* Conteúdo ou editor inline */}
            {editingKey === mem.key ? (
              <div className="space-y-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="text-sm min-h-[80px] resize-none"
                  autoFocus
                />
                <WorkbenchActions>
                  <Button
                    size={compact ? "xs" : "sm"}
                    onClick={handleEditSave}
                    disabled={saving}
                  >
                    {saving && (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    )}
                    {m.memory_save()}
                  </Button>
                  <Button
                    size={compact ? "xs" : "sm"}
                    variant="ghost"
                    onClick={() => setEditingKey(null)}
                    disabled={saving}
                  >
                    {m.memory_cancel()}
                  </Button>
                </WorkbenchActions>
              </div>
            ) : (
              <p className={bodyTextClass}>{mem.content}</p>
            )}

            {/* Ações */}
            {editingKey !== mem.key && (
              <WorkbenchActions>
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-muted-foreground"
                  onClick={() => handleEditStart(mem)}
                >
                  <Edit2 />
                  {m.memory_edit()}
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(mem.key)}
                  disabled={deletingKey === mem.key}
                >
                  {deletingKey === mem.key ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Trash2 />
                  )}
                  {m.memory_delete()}
                </Button>
              </WorkbenchActions>
            )}
          </div>
        ))}

        {extraFacts.map((fact) => (
          <div key={fact.key} className={cardClass}>
            <p className={bodyTextClass}>{fact.content}</p>
          </div>
        ))}

        {extraSkills.map((skill) => (
          <div key={skill.id} className={cardClass}>
            <p className="flex items-center gap-1 truncate text-xs font-medium text-foreground">
              <Sparkles className="h-3 w-3 shrink-0 text-muted-foreground" />
              {m.workbench_memory_journey_skill_label({ name: skill.name })}
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              {skill.description}
            </p>
          </div>
        ))}
      </div>

      {/* Dialog — adicionar memória */}
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) {
            setNewKey("");
            setNewContent("");
            setError(null);
          }
        }}
      >
        <ResizableDialogContent
          storageKey="memory-add"
          defaultWidth={520}
          defaultHeight={400}
          minWidth={380}
          minHeight={280}
          className="gap-4 p-6 overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>{m.memory_add_title()}</DialogTitle>
            <DialogDescription>{m.memory_add_desc()}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {m.memory_add_content_label()}
              </label>
              <Textarea
                placeholder={m.memory_add_content_placeholder()}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="text-sm min-h-[100px] resize-none"
                autoFocus
              />
            </div>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none hover:text-foreground">
                {m.memory_add_key_label()}
              </summary>
              <Input
                placeholder={m.memory_add_key_placeholder()}
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                autoComplete="off"
                className="text-sm mt-2"
              />
            </details>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={adding}
            >
              {m.memory_cancel()}
            </Button>
            <Button
              onClick={handleAddMemory}
              disabled={adding || !newContent.trim()}
            >
              {adding && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {m.memory_save()}
            </Button>
          </DialogFooter>
        </ResizableDialogContent>
      </Dialog>

      {/* Dialog de confirmação — limpar tudo */}
      <Dialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <ResizableDialogContent
          resizable={false}
          defaultWidth={384}
          className="gap-4 p-6"
        >
          <DialogHeader>
            <DialogTitle>{m.memory_clear_title()}</DialogTitle>
            <DialogDescription>{m.memory_clear_desc()}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setClearConfirmOpen(false)}
              disabled={clearing}
            >
              {m.memory_cancel()}
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearAll}
              disabled={clearing}
            >
              {clearing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {m.memory_clear_all()}
            </Button>
          </DialogFooter>
        </ResizableDialogContent>
      </Dialog>
    </div>
  );
}
