"use client";

/**
 * ProviderRoutingTab — modelos de LLM locais/dinâmicos (Ollama, OpenRouter).
 *
 * Ollama: descoberta via GET /provider-routing/ollama/models (consulta
 * {base_url}/api/tags do host configurado — nunca digitação livre de nome de
 * modelo, evita erro de digitação virar falha silenciosa no chat).
 *
 * OpenRouter: exige API key (validada contra /auth/key antes de persistir via
 * POST /provider-routing/openrouter/key), depois permite buscar no catálogo público
 * (GET /provider-routing/openrouter/models?q=, cacheado ~1h no backend) e registrar
 * os modelos desejados.
 *
 * Em ambos os casos, modelos registrados (POST .../registered) aparecem no
 * ModelSelector do composer (GET /models/providers agrega o catálogo
 * estático com os registrados de cada gateway).
 */

import { Loader2, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ProviderIcon } from "@/components/icons/provider-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { m } from "@/lib/paraglide/messages";
import { mDyn } from "@/lib/i18n-dyn";
import type { VectoraDmrOperation } from "@/lib/types/vectora-bridge";
import {
  SettingsMessage,
  SettingsPageNav,
  SettingsSectionHeader,
  SettingsStack,
  SettingsStatus,
  settingsRowClass,
  settingsScrollListClass,
  settingsSectionClass,
} from "@/components/settings/primitives";
import { cn } from "@/lib/utils";

interface OllamaModelInfo {
  name: string;
  size: number | null;
  modified_at: string | null;
}

interface OllamaRuntimeStatus {
  installed: boolean;
  managed?: boolean;
  executable?: string | null;
  reachable: boolean;
  version?: string | null;
  state: "missing" | "installing" | "installed" | "running" | "error";
  phase?:
    | "idle"
    | "detect"
    | "download"
    | "install"
    | "start"
    | "ready"
    | "register"
    | "failed"
    | "cancelled";
  detail?: string | null;
  downloaded?: number;
  download_total?: number | null;
}

async function responseError(
  response: Response,
  fallback: string,
): Promise<string> {
  const payload: unknown = await response.json().catch(() => null);
  if (
    payload &&
    typeof payload === "object" &&
    "detail" in payload &&
    typeof payload.detail === "string"
  ) {
    return payload.detail;
  }
  return fallback;
}

interface RegisteredModel {
  id: string;
  tag: string;
  created_at: string;
}

interface OpenRouterStatus {
  configured: boolean;
  masked: string;
}

interface OpenRouterModelInfo {
  id: string;
  name: string;
  context_length: number | null;
}

interface NineRouterStatus {
  configured: boolean;
  base_url: string | null;
  masked: string;
}

interface NineRouterModelInfo {
  id: string;
  name: string;
  /** Provider de origem informado pelo roteador (`owned_by`). */
  provider?: string;
}

interface LlamaCppModelInfo {
  id: string;
  publisher?: string;
  name?: string;
  format?: string;
  compatibility?: string;
  architecture?: string;
  quantization?: string;
  context_length?: string;
}

interface HuggingFaceFileInfo {
  rfilename: string;
  size?: number | null;
  sha256?: string | null;
  format?: string;
}

interface HuggingFaceMetadata {
  id: string;
  publisher?: string;
  revision?: string;
  license?: string | null;
  downloads?: number;
  architecture?: string;
  quantization?: string;
  context_length?: number | string | null;
  compatibility?: string;
  files?: HuggingFaceFileInfo[];
}

interface LlamaCppRuntimeStatus {
  installed: boolean;
  managed?: boolean;
  external?: boolean;
  reachable?: boolean;
  path: string | null;
  files: string[];
  free_bytes?: number;
  active_runtime?: string | null;
  runtimes: Array<{
    id?: string;
    asset: string;
    sha256: string;
    installed_at?: string;
    source?: string;
    version?: string;
  }>;
  install_progress?: {
    status?: string;
    downloaded?: number;
    total?: number | null;
    phase?: string;
  };
}

interface DmrStatus {
  configured: boolean;
  base_url: string;
  model: string;
  cli_available: boolean;
  reachable: boolean;
  contract: string | null;
  models: string[];
  managed_models: string[];
  detail?: string | null;
  state:
    | "docker_unavailable"
    | "plugin_unavailable"
    | "runner_unavailable"
    | "stopped"
    | "ready";
  runner_available: boolean;
  runner_installed: boolean;
  docker_desktop: boolean;
  plugin_install_supported: boolean;
  platform: string;
  architecture: string;
  backend: string | null;
  capabilities: {
    cpus: number | null;
    memory_bytes: number | null;
    runtimes: string[];
    gpu_backends: string[];
    warnings: string[];
  };
}

interface OllamaConfig {
  configured: boolean;
  base_url: string;
  api_key_configured: boolean;
  api_key_masked: string;
}

async function fetchOllamaConfig(): Promise<OllamaConfig> {
  const response = await fetch("/provider-routing/ollama/config");
  if (!response.ok) throw new Error(`Erro ${response.status}`);
  return (await response.json()) as OllamaConfig;
}

async function saveOllamaConfig(
  baseUrl: string,
  apiKey: string,
  clearApiKey = false,
): Promise<OllamaConfig> {
  const response = await fetch("/provider-routing/ollama/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      base_url: baseUrl,
      api_key: apiKey || null,
      clear_api_key: clearApiKey,
    }),
  });
  if (!response.ok)
    throw new Error(await responseError(response, `Erro ${response.status}`));
  return (await response.json()) as OllamaConfig;
}

interface DmrJob {
  id: string;
  operation: "prepare" | "start";
  reference: string;
  context_size?: number | null;
  progress: number;
  phase:
    | "queued"
    | "pulling"
    | "configuring"
    | "starting"
    | "checking"
    | "completed"
    | "failed"
    | "cancelled"
    | "interrupted";
  status:
    "queued" | "running" | "completed" | "failed" | "cancelled" | "interrupted";
  output?: string;
  error?: string | null;
}

async function discoverModels(): Promise<{
  reachable: boolean;
  models: OllamaModelInfo[];
}> {
  const res = await fetch("/provider-routing/ollama/models");
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

async function fetchOllamaRuntimeStatus(): Promise<OllamaRuntimeStatus> {
  const response = await fetch("/provider-routing/ollama/runtime/status");
  if (!response.ok) throw new Error(`Erro ${response.status}`);
  return (await response.json()) as OllamaRuntimeStatus;
}

async function installOllamaRuntime(
  signal?: AbortSignal,
): Promise<OllamaRuntimeStatus> {
  const response = await fetch("/provider-routing/ollama/runtime/install", {
    method: "POST",
    signal,
  });
  if (!response.ok) {
    throw new Error(await responseError(response, `Erro ${response.status}`));
  }
  return (await response.json()) as OllamaRuntimeStatus;
}

async function discoverLlamaCppModels(): Promise<{
  reachable: boolean;
  models: LlamaCppModelInfo[];
}> {
  const res = await fetch("/provider-routing/llamacpp/models");
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

async function testLlamaCppConnection(): Promise<{
  status: string;
  models?: LlamaCppModelInfo[];
}> {
  const res = await fetch("/provider-routing/llamacpp/test", {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

async function fetchLlamaCppRuntimeStatus(): Promise<LlamaCppRuntimeStatus> {
  const res = await fetch("/provider-routing/llamacpp/runtime/status");
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json() as Promise<LlamaCppRuntimeStatus>;
}

async function cancelLlamaCppRuntimeInstall(): Promise<void> {
  await fetch("/provider-routing/llamacpp/runtime/cancel", { method: "POST" });
}

async function fetchDmrStatus(): Promise<DmrStatus> {
  const bridge = window.vectora?.dmr;
  if (bridge) {
    const [detection, httpStatus, manifest] = await Promise.all([
      bridge.detect(),
      fetch("/provider-routing/dmr/http-status").then(async (response) => {
        if (!response.ok) throw new Error(`Erro ${response.status}`);
        return (await response.json()) as Partial<DmrStatus>;
      }),
      bridge.list(),
    ]);
    const state =
      detection.status === "ready"
        ? httpStatus.reachable
          ? "ready"
          : "stopped"
        : detection.status === "plugin_unavailable"
          ? "plugin_unavailable"
          : detection.status === "runner_unavailable"
            ? "runner_unavailable"
            : detection.status === "docker_unavailable"
              ? "docker_unavailable"
              : "stopped";
    const models = Object.keys(manifest.models);
    return {
      configured: httpStatus.configured ?? false,
      base_url: httpStatus.base_url ?? "http://127.0.0.1:12434",
      model: httpStatus.model ?? models[0] ?? "",
      cli_available: detection.docker && detection.plugin,
      runner_available: detection.runner,
      runner_installed: detection.runnerInstalled ?? false,
      docker_desktop: detection.desktop ?? false,
      plugin_install_supported: detection.pluginInstallSupported ?? false,
      reachable: httpStatus.reachable ?? false,
      contract: httpStatus.contract ?? null,
      models: httpStatus.models ?? models,
      managed_models: httpStatus.managed_models ?? models,
      detail: detection.detail ?? httpStatus.detail,
      state,
      platform: window.vectora?.platform ?? "unknown",
      architecture: "unknown",
      backend: Object.values(manifest.models)[0]?.engine ?? null,
      capabilities: {
        cpus: null,
        memory_bytes: null,
        runtimes: [],
        gpu_backends: [],
        warnings: [],
      },
    };
  }
  const httpResponse = await fetch("/provider-routing/dmr/http-status");
  if (!httpResponse.ok) throw new Error(`Erro ${httpResponse.status}`);
  const httpStatus = (await httpResponse.json()) as Partial<DmrStatus>;
  return {
    configured: httpStatus.configured ?? false,
    base_url: httpStatus.base_url ?? "http://127.0.0.1:12434",
    model: httpStatus.model ?? "",
    cli_available: false,
    runner_available: httpStatus.reachable ?? false,
    runner_installed: false,
    docker_desktop: false,
    plugin_install_supported: false,
    reachable: httpStatus.reachable ?? false,
    contract: httpStatus.contract ?? null,
    models: httpStatus.models ?? [],
    managed_models: httpStatus.managed_models ?? [],
    detail: httpStatus.detail,
    state: httpStatus.reachable ? "ready" : "stopped",
    platform: "web",
    architecture: "unknown",
    backend: null,
    capabilities: {
      cpus: null,
      memory_bytes: null,
      runtimes: [],
      gpu_backends: [],
      warnings: [],
    },
  };
}

async function configureDmr(
  baseUrl: string,
  model: string,
): Promise<DmrStatus> {
  const response = await fetch("/provider-routing/dmr/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base_url: baseUrl, model }),
  });
  if (!response.ok)
    throw new Error(await responseError(response, `Erro ${response.status}`));
  return fetchDmrStatus();
}

async function detectDmrModels(): Promise<string[]> {
  const response = await fetch("/provider-routing/dmr/models");
  if (!response.ok)
    throw new Error(await responseError(response, `Erro ${response.status}`));
  const data = (await response.json()) as { models?: string[] };
  return data.models ?? [];
}

async function testDmrHttpConnection(
  baseUrl: string,
  model: string,
): Promise<Partial<DmrStatus>> {
  const response = await fetch("/provider-routing/dmr/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base_url: baseUrl, model }),
  });
  if (!response.ok)
    throw new Error(await responseError(response, `Erro ${response.status}`));
  return (await response.json()) as Partial<DmrStatus>;
}

async function prepareDmrModel(reference: string): Promise<DmrStatus> {
  const response = await fetch("/provider-routing/dmr/models/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference }),
  });
  if (!response.ok) throw new Error(`Erro ${response.status}`);
  return (await response.json()) as DmrStatus;
}

async function createDmrModelJob(
  reference: string,
  operationKind: "prepare" | "start" = "start",
  contextSize?: number,
): Promise<DmrJob> {
  const bridge = window.vectora?.dmr;
  if (bridge) {
    const operation =
      operationKind === "prepare"
        ? await bridge.prepare(reference)
        : await bridge.start(reference, contextSize);
    return dmrOperationToJob(operation);
  }
  const response = await fetch("/provider-routing/dmr/models/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reference,
      operation: operationKind,
      ...(contextSize === undefined ? {} : { context_size: contextSize }),
    }),
  });
  if (!response.ok) throw new Error(`Erro ${response.status}`);
  return (await response.json()) as DmrJob;
}

function dmrOperationToJob(operation: VectoraDmrOperation): DmrJob {
  const phase: DmrJob["phase"] =
    operation.phase === "stopping" ||
    operation.phase === "removing" ||
    operation.phase === "installing" ||
    operation.phase === "installing_plugin" ||
    operation.phase === "installing_runner"
      ? "checking"
      : operation.phase;
  return {
    id: operation.id,
    operation: operation.operation === "prepare" ? "prepare" : "start",
    reference: operation.reference,
    progress: operation.progress,
    phase,
    status: operation.status,
    output: operation.output,
    error: operation.error,
  };
}

async function fetchDmrModelJob(jobId: string): Promise<DmrJob> {
  const bridge = window.vectora?.dmr;
  if (bridge) {
    const operation = await bridge.getOperation(jobId);
    if (!operation) throw new Error("operação DMR não encontrada");
    return dmrOperationToJob(operation);
  }
  const response = await fetch(`/provider-routing/dmr/models/jobs/${jobId}`);
  if (!response.ok) throw new Error(`Erro ${response.status}`);
  return (await response.json()) as DmrJob;
}

async function fetchDmrModelJobs(): Promise<DmrJob[]> {
  const bridge = window.vectora?.dmr;
  if (bridge) {
    return (await bridge.listOperations()).map(dmrOperationToJob);
  }
  const response = await fetch("/provider-routing/dmr/models/jobs");
  if (!response.ok) throw new Error(`Erro ${response.status}`);
  const payload = (await response.json()) as { jobs?: DmrJob[] };
  return payload.jobs ?? [];
}

async function retryDmrModelJob(jobId: string): Promise<DmrJob> {
  const response = await fetch(
    `/provider-routing/dmr/models/jobs/${jobId}/retry`,
    {
      method: "POST",
    },
  );
  if (!response.ok) throw new Error(`Erro ${response.status}`);
  return (await response.json()) as DmrJob;
}

async function cancelDmrModelJob(jobId: string): Promise<DmrJob> {
  const bridge = window.vectora?.dmr;
  if (bridge) {
    await bridge.cancel(jobId);
    const operation = await bridge.getOperation(jobId);
    if (!operation) throw new Error("operação DMR não encontrada");
    return dmrOperationToJob(operation);
  }
  const response = await fetch(`/provider-routing/dmr/models/jobs/${jobId}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(`Erro ${response.status}`);
  return (await response.json()) as DmrJob;
}

async function stopDmrModel(reference: string): Promise<DmrStatus> {
  const bridge = window.vectora?.dmr;
  if (bridge) {
    await waitForDmrOperation(bridge.stop(reference));
    return fetchDmrStatus();
  }
  const response = await fetch("/provider-routing/dmr/models/stop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference }),
  });
  if (!response.ok) throw new Error(`Erro ${response.status}`);
  return fetchDmrStatus();
}

async function removeDmrModel(reference: string): Promise<DmrStatus> {
  const bridge = window.vectora?.dmr;
  if (bridge) {
    await waitForDmrOperation(bridge.remove(reference, true));
    return fetchDmrStatus();
  }
  const response = await fetch(
    `/provider-routing/dmr/models/${encodeURIComponent(reference)}?confirm=true`,
    { method: "DELETE" },
  );
  if (!response.ok) throw new Error(`Erro ${response.status}`);
  return fetchDmrStatus();
}

async function waitForDmrOperation(
  operationPromise: Promise<VectoraDmrOperation>,
): Promise<void> {
  const bridge = window.vectora?.dmr;
  if (!bridge) return;
  let operation = await operationPromise;
  while (operation.status === "queued" || operation.status === "running") {
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    const next = await bridge.getOperation(operation.id);
    if (!next) throw new Error("operação DMR não encontrada");
    operation = next;
  }
  if (operation.status !== "completed") {
    throw new Error(operation.error ?? "operação DMR falhou");
  }
}

function DmrSection() {
  const [status, setStatus] = useState<DmrStatus | null>(null);
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:12434");
  const [model, setModel] = useState("");
  const [contextSize, setContextSize] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [job, setJob] = useState<DmrJob | null>(null);
  const [runtimeOperation, setRuntimeOperation] =
    useState<VectoraDmrOperation | null>(null);
  const [modelQuery, setModelQuery] = useState("");
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const canManageDocker = Boolean(window.vectora?.dmr);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchDmrStatus();
      setStatus(next);
      setBaseUrl(next.base_url);
      setModel(next.model);
      if (!window.vectora?.dmr) return;
      const jobs = await fetchDmrModelJobs();
      const active = jobs.find(
        (candidate) =>
          candidate.status === "queued" ||
          candidate.status === "running" ||
          candidate.status === "interrupted",
      );
      setJob(active ?? null);
    } catch {
      setError("Não foi possível consultar o Docker Model Runner.");
    }
  }, []);

  useEffect(() => {
    // External status synchronization intentionally updates local form state.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function save() {
    setBusy(true);
    setError("");
    try {
      setStatus(await configureDmr(baseUrl, model));
    } catch {
      setError("Não foi possível salvar o endpoint do Docker Model Runner.");
    } finally {
      setBusy(false);
    }
  }

  async function testConnection() {
    setBusy(true);
    setError("");
    try {
      const next = await testDmrHttpConnection(baseUrl, model);
      setStatus((current) =>
        current
          ? {
              ...current,
              ...next,
              base_url: baseUrl,
              model,
              state: next.reachable ? "ready" : "stopped",
            }
          : current,
      );
    } catch (testError) {
      setError(
        testError instanceof Error
          ? testError.message
          : "Falha ao verificar o endpoint.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function detectModels() {
    setDiscovering(true);
    setError("");
    try {
      setDiscoveredModels(await detectDmrModels());
    } catch (detectError) {
      setError(
        detectError instanceof Error
          ? detectError.message
          : "Falha ao detectar modelos.",
      );
    } finally {
      setDiscovering(false);
    }
  }

  async function prepare() {
    if (!model.trim()) return;
    setBusy(true);
    setError("");
    try {
      const parsedContext = contextSize.trim()
        ? Number(contextSize)
        : undefined;
      if (parsedContext !== undefined && !Number.isInteger(parsedContext)) {
        throw new Error("tamanho de contexto inválido");
      }
      let current = await createDmrModelJob(
        model.trim(),
        "start",
        parsedContext,
      );
      setJob(current);
      while (current.status === "queued" || current.status === "running") {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        current = await fetchDmrModelJob(current.id);
        setJob(current);
      }
      if (current.status !== "completed") {
        throw new Error(current.error ?? "operação DMR falhou");
      }
      setStatus(await fetchDmrStatus());
    } catch {
      setError("Não foi possível preparar o modelo no Docker Model Runner.");
    } finally {
      setBusy(false);
    }
  }

  async function installRunner() {
    const bridge = window.vectora?.dmr;
    if (!bridge) return;
    setBusy(true);
    setError("");
    try {
      let operation = await bridge.ensureRunner();
      setRuntimeOperation(operation);
      while (operation.status === "queued" || operation.status === "running") {
        await new Promise((resolve) => window.setTimeout(resolve, 300));
        const next = await bridge.getOperation(operation.id);
        if (!next) throw new Error("operação DMR não encontrada");
        operation = next;
        setRuntimeOperation(operation);
      }
      if (operation.status !== "completed") {
        throw new Error(operation.error ?? "operação DMR falhou");
      }
      await refresh();
    } catch (installError) {
      setError(
        installError instanceof Error
          ? installError.message
          : "Não foi possível instalar ou ativar o Docker Model Runner.",
      );
    } finally {
      setRuntimeOperation(null);
      setBusy(false);
    }
  }

  async function cancelRunnerInstall() {
    const bridge = window.vectora?.dmr;
    if (!bridge || !runtimeOperation) return;
    if (await bridge.cancel(runtimeOperation.id)) {
      setRuntimeOperation({
        ...runtimeOperation,
        status: "cancelled",
        phase: "cancelled",
      });
    }
  }

  async function cancelPrepare() {
    if (!job || (job.status !== "queued" && job.status !== "running")) return;
    try {
      setJob(await cancelDmrModelJob(job.id));
    } catch {
      setError("Não foi possível cancelar a operação do Docker Model Runner.");
    }
  }

  async function retryPrepare() {
    if (!job || job.status !== "interrupted") return;
    setBusy(true);
    setError("");
    try {
      let current = await retryDmrModelJob(job.id);
      setJob(current);
      while (current.status === "queued" || current.status === "running") {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        current = await fetchDmrModelJob(current.id);
        setJob(current);
      }
      if (current.status !== "completed") {
        throw new Error(current.error ?? "operação DMR falhou");
      }
      setStatus(await fetchDmrStatus());
    } catch {
      setError("Não foi possível retomar a operação do Docker Model Runner.");
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (!model.trim()) return;
    setBusy(true);
    setError("");
    try {
      setStatus(await stopDmrModel(model.trim()));
    } catch {
      setError("Não foi possível parar o modelo no Docker Model Runner.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!model.trim() || !window.confirm("Remover este modelo do Docker?"))
      return;
    setBusy(true);
    setError("");
    try {
      setStatus(await removeDmrModel(model.trim()));
    } catch {
      setError("Não foi possível remover o modelo do Docker Model Runner.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={settingsSectionClass}>
      <SettingsSectionHeader
        icon={<ProviderIcon provider="dmr" className="size-3.5" />}
        title={m.provider_routing_dmr_title()}
        description={m.provider_routing_dmr_subtitle()}
      />
      <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
        <Input
          aria-label={m.provider_routing_dmr_endpoint()}
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder={m.provider_routing_dmr_endpoint_placeholder()}
        />
        <Input
          aria-label={m.provider_routing_dmr_model()}
          value={model}
          onChange={(event) => setModel(event.target.value)}
          placeholder={m.provider_routing_dmr_model_placeholder()}
        />
        <Input
          aria-label={m.provider_routing_hf_ctx_size()}
          type="number"
          min={1}
          max={1000000}
          value={contextSize}
          onChange={(event) => setContextSize(event.target.value)}
          placeholder={m.provider_routing_hf_ctx_size()}
        />
        <Button
          size="sm"
          type="button"
          disabled={busy}
          onClick={() => void save()}
        >
          {m.provider_routing_dmr_save()}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void testConnection()}
        >
          {m.provider_routing_dmr_test()}
        </Button>
        {canManageDocker &&
          status?.cli_available &&
          !status.runner_available && (
            <Button
              size="sm"
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void installRunner()}
            >
              {status.docker_desktop
                ? m.provider_routing_dmr_enable_runner()
                : status.runner_installed
                  ? m.provider_routing_dmr_start_runner()
                  : m.provider_routing_dmr_install_runner()}
            </Button>
          )}
        {canManageDocker &&
          status?.state === "plugin_unavailable" &&
          status.plugin_install_supported && (
            <Button
              size="sm"
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void installRunner()}
            >
              {m.provider_routing_dmr_install_plugin()}
            </Button>
          )}
        {runtimeOperation &&
          (runtimeOperation.status === "queued" ||
            runtimeOperation.status === "running") && (
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() => void cancelRunnerInstall()}
            >
              {m.provider_routing_dmr_cancel()}
            </Button>
          )}
        {canManageDocker &&
          status?.state === "plugin_unavailable" &&
          !status.plugin_install_supported && (
            <a
              className="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
              href="https://docs.docker.com/ai/model-runner/get-started/"
              target="_blank"
              rel="noreferrer"
            >
              {m.provider_routing_dmr_install_instructions()}
            </a>
          )}
        {canManageDocker &&
        job &&
        (job.status === "queued" || job.status === "running") ? (
          <Button
            size="sm"
            type="button"
            variant="outline"
            onClick={() => void cancelPrepare()}
          >
            {m.provider_routing_dmr_cancel()}
          </Button>
        ) : canManageDocker && job?.status === "interrupted" ? (
          <Button
            size="sm"
            type="button"
            disabled={busy}
            onClick={() => void retryPrepare()}
          >
            {m.provider_routing_dmr_prepare()}
          </Button>
        ) : canManageDocker ? (
          <Button
            size="sm"
            type="button"
            disabled={busy || !model.trim() || !status?.runner_available}
            onClick={() => void prepare()}
          >
            {m.provider_routing_dmr_prepare()}
          </Button>
        ) : null}
        {canManageDocker && (
          <Button
            size="sm"
            type="button"
            variant="outline"
            disabled={busy || !model.trim() || status?.state !== "ready"}
            onClick={() => void stop()}
          >
            {m.provider_routing_dmr_stop()}
          </Button>
        )}
        {canManageDocker && (
          <Button
            size="sm"
            type="button"
            variant="ghost"
            disabled={busy || !model.trim()}
            onClick={() => void remove()}
          >
            {m.provider_routing_dmr_remove()}
          </Button>
        )}
      </div>
      {runtimeOperation &&
        (runtimeOperation.status === "queued" ||
          runtimeOperation.status === "running") && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border px-3 py-2 text-xs text-muted-foreground"
          >
            {runtimeOperation.operation === "install_plugin"
              ? m.provider_routing_dmr_installing_plugin()
              : runtimeOperation.phase === "installing_runner"
                ? m.provider_routing_dmr_installing()
                : runtimeOperation.operation === "start_runner"
                  ? m.provider_routing_dmr_starting_runner()
                  : m.provider_routing_dmr_installing()}
            <progress
              aria-label={
                runtimeOperation.operation === "install_plugin"
                  ? m.provider_routing_dmr_installing_plugin()
                  : runtimeOperation.phase === "installing_runner"
                    ? m.provider_routing_dmr_installing()
                    : runtimeOperation.operation === "start_runner"
                      ? m.provider_routing_dmr_starting_runner()
                      : m.provider_routing_dmr_installing()
              }
              className="mt-2 block h-1.5 w-full"
            />
          </div>
        )}
      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={modelQuery}
              onChange={(event) => setModelQuery(event.target.value)}
              placeholder={m.provider_routing_nine_router_search_placeholder()}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Button
            size="sm"
            type="button"
            variant="outline"
            disabled={discovering || busy}
            onClick={() => void detectModels()}
          >
            {discovering ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 size-3.5" />
            )}
            {m.provider_routing_detect_models()}
          </Button>
        </div>
        {discoveredModels
          .filter((item) =>
            item.toLowerCase().includes(modelQuery.trim().toLowerCase()),
          )
          .map((item) => (
            <button
              key={item}
              type="button"
              className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50"
              onClick={() => setModel(item)}
            >
              <span className="truncate font-mono">{item}</span>
              <span className="text-xs text-muted-foreground">
                {m.provider_routing_dmr_select_model()}
              </span>
            </button>
          ))}
      </div>
      {status && (
        <p className="text-xs text-muted-foreground">
          {status.state === "ready"
            ? m.provider_routing_dmr_ready({ contract: status.contract ?? "?" })
            : status.state === "stopped"
              ? m.provider_routing_dmr_stopped()
              : status.state === "plugin_unavailable"
                ? m.provider_routing_dmr_missing_plugin()
                : status.state === "runner_unavailable"
                  ? m.provider_routing_dmr_runner_unavailable()
                  : m.provider_routing_dmr_missing_cli()}
          {` · ${status.platform}/${status.architecture}`}
          {status.backend ? ` · ${status.backend}` : ""}
          {status.capabilities.gpu_backends.length
            ? ` · GPU: ${status.capabilities.gpu_backends.join(", ")}`
            : ""}
          {status.models.length ? ` · ${status.models.join(", ")}` : ""}
          {status.managed_models.length
            ? ` · ${status.managed_models.join(", ")}`
            : ""}
        </p>
      )}
      {job && (job.status === "queued" || job.status === "running") && (
        <p className="text-xs text-muted-foreground">
          {m.provider_routing_dmr_job_running({
            status: `${job.phase} · ${job.progress}%`,
          })}
        </p>
      )}
      {job?.status === "cancelled" && (
        <p className="text-xs text-muted-foreground">
          {m.provider_routing_dmr_job_cancelled()}
        </p>
      )}
      {job?.status === "interrupted" && (
        <p className="text-xs text-muted-foreground">
          {m.provider_routing_dmr_job_interrupted()}
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

async function searchHuggingFaceModels(
  query: string,
  provider: "ollama" | "llamacpp" | "dmr" = "llamacpp",
): Promise<LlamaCppModelInfo[]> {
  const res = await fetch(
    `/provider-routing/huggingface/models?q=${encodeURIComponent(query)}&provider=${provider}`,
  );
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  const data = (await res.json()) as { models?: LlamaCppModelInfo[] };
  return data.models ?? [];
}

async function downloadHuggingFaceModel(
  repoId: string,
  filename?: string,
  revision = "main",
  signal?: AbortSignal,
): Promise<{ path: string; filename: string }> {
  const metadataResponse = await fetch(
    `/provider-routing/huggingface/models/${repoId
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/")}`,
    { signal },
  );
  if (!metadataResponse.ok) throw new Error(`Erro ${metadataResponse.status}`);
  const metadata = (await metadataResponse.json()) as {
    files?: Array<{ rfilename: string; format?: string; sha256?: string }>;
  };
  const file = filename
    ? metadata.files?.find((item) => item.rfilename === filename)
    : metadata.files?.find((item) => item.format === "GGUF");
  if (!file) throw new Error("Nenhum arquivo GGUF encontrado");
  const response = await fetch("/provider-routing/huggingface/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      repo_id: repoId,
      filename: file.rfilename,
      revision,
      ...(file.sha256 ? { sha256: file.sha256 } : {}),
    }),
    signal,
  });
  if (!response.ok) throw new Error(`Erro ${response.status}`);
  const result = (await response.json()) as { path: string };
  return { path: result.path, filename: file.rfilename };
}

async function fetchHuggingFaceMetadata(
  repoId: string,
): Promise<HuggingFaceMetadata> {
  const encodedRepo = repoId
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const response = await fetch(
    `/provider-routing/huggingface/models/${encodedRepo}`,
  );
  if (!response.ok) throw new Error(`Erro ${response.status}`);
  return (await response.json()) as HuggingFaceMetadata;
}

async function installHuggingFaceModel(input: {
  repoId: string;
  revision: string;
  filename: string;
  mmprojFilename?: string;
  alias: string;
  provider: "ollama" | "llamacpp";
  license?: string | null;
  architecture?: string;
  quantization?: string;
  contextLength?: number | string | null;
  compatibility?: string;
}): Promise<void> {
  const response = await fetch("/provider-routing/huggingface/install", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      repo_id: input.repoId,
      revision: input.revision,
      filename: input.filename,
      mmproj_filename: input.mmprojFilename,
      alias: input.alias,
      provider: input.provider,
      license: input.license,
      architecture: input.architecture,
      quantization: input.quantization,
      context_length: input.contextLength,
      compatibility: input.compatibility,
    }),
  });
  if (!response.ok) throw new Error(`Erro ${response.status}`);
  await registerModel(
    input.provider === "ollama" ? "ollama" : "llamacpp",
    input.alias,
  );
}

async function cancelHuggingFaceDownload(
  repoId: string,
  filename: string,
  revision: string,
): Promise<void> {
  const params = new URLSearchParams({ repo_id: repoId, filename, revision });
  await fetch(`/provider-routing/huggingface/download?${params.toString()}`, {
    method: "DELETE",
  });
}

async function fetchHuggingFaceDownloadProgress(
  repoId: string,
  filename: string,
  revision: string,
): Promise<{ downloaded: number; total: number | null; status: string }> {
  const params = new URLSearchParams({ repo_id: repoId, filename, revision });
  const response = await fetch(
    `/provider-routing/huggingface/download/progress?${params.toString()}`,
  );
  if (!response.ok) throw new Error(`Erro ${response.status}`);
  return (await response.json()) as {
    downloaded: number;
    total: number | null;
    status: string;
  };
}

async function startInstalledHuggingFaceModel(
  repoId: string,
  filename: string,
  options: {
    ctx_size?: number;
    n_gpu_layers?: number;
    threads?: number;
    parallel?: number;
    jinja: boolean;
  },
): Promise<void> {
  const response = await fetch("/provider-routing/huggingface/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo_id: repoId, filename, ...options }),
  });
  if (!response.ok) throw new Error(`Erro ${response.status}`);
  const modeResponse = await fetch("/provider-routing/llamacpp/mode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "managed" }),
  });
  if (!modeResponse.ok) throw new Error(`Erro ${modeResponse.status}`);
}

function HuggingFaceCatalogSection() {
  const [provider, setProvider] = useState<"ollama" | "llamacpp" | "dmr">(
    "llamacpp",
  );
  const [query, setQuery] = useState("llama");
  const [models, setModels] = useState<LlamaCppModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloaded, setDownloaded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const downloadController = useRef<AbortController | null>(null);
  const [metadata, setMetadata] = useState<HuggingFaceMetadata | null>(null);
  const [selectedFile, setSelectedFile] = useState("");
  const [selectedMmproj, setSelectedMmproj] = useState("");
  const [alias, setAlias] = useState("");
  const [installing, setInstalling] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState<number | null>(null);
  const [dmrJobId, setDmrJobId] = useState<string | null>(null);
  const [installedModel, setInstalledModel] = useState<{
    repoId: string;
    filename: string;
    options: {
      ctx_size?: number;
      n_gpu_layers?: number;
      threads?: number;
      parallel?: number;
      jinja: boolean;
    };
  } | null>(null);
  const [ctxSize, setCtxSize] = useState("4096");
  const [gpuLayers, setGpuLayers] = useState("");
  const [threads, setThreads] = useState("");
  const [parallel, setParallel] = useState("1");
  const [jinja, setJinja] = useState(false);

  function selectedFileSize(): string {
    const size = metadata?.files?.find(
      (item) => item.rfilename === selectedFile,
    )?.size;
    if (!size) return "?";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = size;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index += 1;
    }
    return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  }

  function selectedFileHash(): string {
    return (
      metadata?.files?.find((item) => item.rfilename === selectedFile)
        ?.sha256 || m.provider_routing_hf_metadata_unknown()
    );
  }

  async function search() {
    setLoading(true);
    setError(null);
    try {
      setModels(await searchHuggingFaceModels(query, provider));
    } catch {
      setError("Erro ao consultar a Hugging Face");
    } finally {
      setLoading(false);
    }
  }

  async function prepareModel(repoId: string) {
    setError(null);
    try {
      const data = await fetchHuggingFaceMetadata(repoId);
      if (provider === "dmr") {
        setMetadata(data);
        setSelectedFile("");
        setSelectedMmproj("");
        setAlias(`hf.co/${repoId}`);
        return;
      }
      const gguf = (data.files ?? []).filter((item) => item.format === "GGUF");
      if (!gguf.length) throw new Error("Nenhum arquivo GGUF encontrado");
      setMetadata(data);
      setSelectedFile(gguf[0]?.rfilename ?? "");
      setSelectedMmproj(
        (data.files ?? []).find((item) => /mmproj/i.test(item.rfilename))
          ?.rfilename ?? "",
      );
      setAlias(gguf[0]?.rfilename ?? "");
    } catch {
      setError(m.provider_routing_hf_download_error());
    }
  }

  async function installSelectedModel() {
    if (!metadata || !alias.trim() || (provider !== "dmr" && !selectedFile)) {
      return;
    }
    const controller = new AbortController();
    downloadController.current = controller;
    setInstalling(true);
    setDownloadPercent(0);
    setError(null);
    let progressTimer: number | undefined;
    try {
      if (provider === "dmr") {
        let job = await createDmrModelJob(`hf.co/${metadata.id}`, "start");
        setDmrJobId(job.id);
        while (job.status === "queued" || job.status === "running") {
          await new Promise((resolve) => window.setTimeout(resolve, 500));
          job = await fetchDmrModelJob(job.id);
        }
        if (job.status !== "completed") {
          throw new Error(job.error ?? "operação DMR falhou");
        }
        setDownloaded(`hf.co/${metadata.id}`);
        setMetadata(null);
        return;
      }
      const revision = metadata.revision ?? "main";
      progressTimer = window.setInterval(() => {
        void fetchHuggingFaceDownloadProgress(
          metadata.id,
          selectedFile,
          revision,
        ).then((progress) => {
          if (progress.total && progress.total > 0) {
            setDownloadPercent(
              Math.min(
                100,
                Math.round((progress.downloaded / progress.total) * 100),
              ),
            );
          }
        });
      }, 500);
      await downloadHuggingFaceModel(
        metadata.id,
        selectedFile,
        revision,
        controller.signal,
      );
      if (selectedMmproj) {
        await downloadHuggingFaceModel(
          metadata.id,
          selectedMmproj,
          revision,
          controller.signal,
        );
      }
      await installHuggingFaceModel({
        repoId: metadata.id,
        revision,
        filename: selectedFile,
        mmprojFilename: selectedMmproj || undefined,
        alias: alias.trim(),
        provider,
        license: metadata.license,
        architecture: metadata.architecture,
        quantization: metadata.quantization,
        contextLength: metadata.context_length,
        compatibility: metadata.compatibility,
      });
      setDownloaded(alias.trim());
      setDownloadPercent(100);
      if (provider === "llamacpp") {
        setInstalledModel({
          repoId: metadata.id,
          filename: selectedFile,
          options: {
            ctx_size: Number(ctxSize) || undefined,
            n_gpu_layers: gpuLayers === "" ? undefined : Number(gpuLayers),
            threads: threads === "" ? undefined : Number(threads),
            parallel: Number(parallel) || undefined,
            jinja,
          },
        });
      }
      setMetadata(null);
    } catch (installError: unknown) {
      if (
        !(installError instanceof DOMException) ||
        installError.name !== "AbortError"
      ) {
        setError(m.provider_routing_hf_download_error());
      }
    } finally {
      if (downloadController.current === controller) {
        downloadController.current = null;
      }
      setDmrJobId(null);
      if (progressTimer !== undefined) window.clearInterval(progressTimer);
      setInstalling(false);
      setDownloadPercent(null);
    }
  }

  return (
    <div className={settingsSectionClass}>
      <SettingsSectionHeader
        icon={<ProviderIcon provider="huggingface" className="size-3.5" />}
        title={m.provider_routing_hf_title()}
        description={m.provider_routing_hf_subtitle()}
      />
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label={m.provider_routing_hf_query_placeholder()}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={m.provider_routing_hf_query_placeholder()}
          className="min-w-48 flex-1"
        />
        <select
          aria-label={m.provider_routing_hf_runtime_label()}
          className="rounded-md border bg-background px-3 text-sm"
          value={provider}
          onChange={(event) =>
            setProvider(event.target.value as "ollama" | "llamacpp")
          }
        >
          <option value="llamacpp">
            {m.provider_routing_llamacpp_title()}
          </option>
          <option value="ollama">{m.provider_routing_ollama_title()}</option>
          <option value="dmr">{m.provider_routing_dmr_title()}</option>
        </select>
        <Button
          size="sm"
          type="button"
          onClick={() => void search()}
          disabled={loading}
        >
          <Search className="mr-2 size-4" /> {m.provider_routing_hf_search()}
        </Button>
      </div>
      {models.length > 0 && (
        <div className="space-y-2 text-sm">
          {models.map((model) => (
            <div
              key={model.id}
              className="flex items-center justify-between gap-3 rounded-md border bg-muted/10 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{model.id}</p>
                <p className="text-xs text-muted-foreground">
                  {m.provider_routing_hf_origin({
                    publisher: model.publisher || model.id.split("/")[0] || "?",
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {m.provider_routing_hf_model_metadata({
                    format: model.format || "GGUF",
                    compatibility:
                      model.compatibility ||
                      m.provider_routing_hf_compatibility_unknown(),
                    architecture:
                      model.architecture ||
                      m.provider_routing_hf_metadata_unknown(),
                    quantization:
                      model.quantization ||
                      m.provider_routing_hf_metadata_unknown(),
                    context:
                      model.context_length ||
                      m.provider_routing_hf_metadata_unknown(),
                  })}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={installing}
                onClick={() => void prepareModel(model.id)}
              >
                {m.provider_routing_hf_install()}
              </Button>
            </div>
          ))}
        </div>
      )}
      {metadata && (
        <div className={cn(settingsSectionClass, "bg-muted/20 text-sm")}>
          <div>
            <p className="font-medium">{metadata.id}</p>
            <p className="text-xs text-muted-foreground">
              {m.provider_routing_hf_origin({
                publisher:
                  metadata.publisher || metadata.id.split("/")[0] || "?",
              })}
            </p>
            <p className="text-xs text-muted-foreground">
              {m.provider_routing_hf_review({
                license: metadata.license ?? "desconhecida",
                downloads: String(metadata.downloads ?? 0),
              })}
            </p>
            <p className="text-xs text-muted-foreground">
              {m.provider_routing_hf_file_details({
                revision: metadata.revision ?? "main",
                size: selectedFileSize(),
                sha256: selectedFileHash(),
              })}
            </p>
            <p className="text-xs text-muted-foreground">
              {m.provider_routing_hf_model_metadata({
                format: "GGUF",
                compatibility:
                  metadata.compatibility ||
                  m.provider_routing_hf_compatibility_unknown(),
                architecture:
                  metadata.architecture ||
                  m.provider_routing_hf_metadata_unknown(),
                quantization:
                  metadata.quantization ||
                  m.provider_routing_hf_metadata_unknown(),
                context:
                  metadata.context_length ||
                  m.provider_routing_hf_metadata_unknown(),
              })}
            </p>
          </div>
          {provider === "dmr" ? (
            <p className="text-xs text-muted-foreground">
              {m.provider_routing_dmr_model()}: {`hf.co/${metadata.id}`}
            </p>
          ) : (
            <>
              <Label htmlFor="hf-model-file">
                {m.provider_routing_hf_model_file()}
              </Label>
              <select
                id="hf-model-file"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={selectedFile}
                onChange={(event) => setSelectedFile(event.target.value)}
                disabled={installing}
              >
                {(metadata.files ?? [])
                  .filter((item) => item.format === "GGUF")
                  .map((item) => (
                    <option key={item.rfilename} value={item.rfilename}>
                      {item.rfilename}
                    </option>
                  ))}
              </select>
              <Label htmlFor="hf-mmproj-file">
                {m.provider_routing_hf_mmproj_file()}
              </Label>
              <select
                id="hf-mmproj-file"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={selectedMmproj}
                onChange={(event) => setSelectedMmproj(event.target.value)}
                disabled={installing}
              >
                <option value="">{m.provider_routing_hf_mmproj_none()}</option>
                {(metadata.files ?? [])
                  .filter((item) => /mmproj/i.test(item.rfilename))
                  .map((item) => (
                    <option key={item.rfilename} value={item.rfilename}>
                      {item.rfilename}
                    </option>
                  ))}
              </select>
            </>
          )}
          <Input
            aria-label={m.provider_routing_hf_alias()}
            value={alias}
            onChange={(event) => setAlias(event.target.value)}
            placeholder={m.provider_routing_hf_alias()}
            disabled={installing}
          />
          {provider !== "dmr" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                aria-label={m.provider_routing_hf_ctx_size()}
                type="number"
                min={1}
                value={ctxSize}
                onChange={(event) => setCtxSize(event.target.value)}
                placeholder={m.provider_routing_hf_ctx_size()}
                disabled={installing}
              />
              <Input
                aria-label={m.provider_routing_hf_gpu_layers()}
                type="number"
                value={gpuLayers}
                onChange={(event) => setGpuLayers(event.target.value)}
                placeholder={m.provider_routing_hf_gpu_layers()}
                disabled={installing}
              />
              <Input
                aria-label={m.provider_routing_hf_threads()}
                type="number"
                min={1}
                value={threads}
                onChange={(event) => setThreads(event.target.value)}
                placeholder={m.provider_routing_hf_threads()}
                disabled={installing}
              />
              <Input
                aria-label={m.provider_routing_hf_parallel()}
                type="number"
                min={1}
                value={parallel}
                onChange={(event) => setParallel(event.target.value)}
                placeholder={m.provider_routing_hf_parallel()}
                disabled={installing}
              />
            </div>
          )}
          {provider !== "dmr" && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={jinja}
                onChange={(event) => setJinja(event.target.checked)}
                disabled={installing}
              />
              {m.provider_routing_hf_jinja()}
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              type="button"
              variant="ghost"
              disabled={installing}
              onClick={() => setMetadata(null)}
            >
              {m.provider_routing_hf_cancel()}
            </Button>
            {installing ? (
              <Button
                size="sm"
                type="button"
                variant="outline"
                onClick={() => {
                  if (provider === "dmr" && dmrJobId) {
                    void cancelDmrModelJob(dmrJobId);
                    return;
                  }
                  downloadController.current?.abort();
                  if (metadata) {
                    const revision = metadata.revision ?? "main";
                    void Promise.all([
                      cancelHuggingFaceDownload(
                        metadata.id,
                        selectedFile,
                        revision,
                      ),
                      selectedMmproj
                        ? cancelHuggingFaceDownload(
                            metadata.id,
                            selectedMmproj,
                            revision,
                          )
                        : Promise.resolve(),
                    ]);
                  }
                }}
              >
                {m.provider_routing_hf_cancel()}
              </Button>
            ) : (
              <Button
                size="sm"
                type="button"
                onClick={() => void installSelectedModel()}
                disabled={
                  !alias.trim() || (provider !== "dmr" && !selectedFile)
                }
              >
                {m.provider_routing_hf_install()}
              </Button>
            )}
          </div>
        </div>
      )}
      {installing && downloadPercent !== null && (
        <p className="text-xs text-muted-foreground">
          {m.provider_routing_hf_download_progress({
            percent: String(downloadPercent),
          })}
        </p>
      )}
      {downloaded && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {m.provider_routing_hf_downloaded({ path: downloaded })}
          </p>
          {installedModel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setError(null);
                void startInstalledHuggingFaceModel(
                  installedModel.repoId,
                  installedModel.filename,
                  installedModel.options,
                ).catch(() =>
                  setError(m.provider_routing_llamacpp_unreachable()),
                );
              }}
            >
              {m.provider_routing_hf_start()}
            </Button>
          )}
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

type Gateway = "ollama" | "openrouter" | "nine-router" | "llamacpp";

async function fetchRegistered(gateway: Gateway): Promise<RegisteredModel[]> {
  const res = await fetch(`/provider-routing/${gateway}/registered`);
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

async function registerModel(gateway: Gateway, tag: string): Promise<void> {
  const res = await fetch(`/provider-routing/${gateway}/registered`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tag }),
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
}

async function unregisterModel(gateway: Gateway, id: string): Promise<void> {
  const res = await fetch(`/provider-routing/${gateway}/registered/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
}

async function fetchOpenRouterStatus(): Promise<OpenRouterStatus> {
  const res = await fetch("/provider-routing/openrouter/status");
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

async function saveOpenRouterKey(apiKey: string): Promise<OpenRouterStatus> {
  const res = await fetch("/provider-routing/openrouter/key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "" }));
    throw new Error(body.detail || `Erro ${res.status}`);
  }
  return res.json();
}

async function removeOpenRouterKey(): Promise<void> {
  const res = await fetch("/provider-routing/openrouter/key", {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
}

async function searchOpenRouterCatalog(
  q: string,
): Promise<OpenRouterModelInfo[]> {
  const res = await fetch(
    `/provider-routing/openrouter/models${q ? `?q=${encodeURIComponent(q)}` : ""}`,
  );
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  const data = await res.json();
  return data.models;
}

async function fetchNineRouterStatus(): Promise<NineRouterStatus> {
  const res = await fetch("/provider-routing/nine-router/status");
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

async function saveNineRouterConfig(
  baseUrl: string,
  apiKey: string,
): Promise<NineRouterStatus> {
  const res = await fetch("/provider-routing/nine-router/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base_url: baseUrl, api_key: apiKey }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "" }));
    throw new Error(body.detail || `Erro ${res.status}`);
  }
  return res.json();
}

async function removeNineRouterConfig(): Promise<void> {
  const res = await fetch("/provider-routing/nine-router/config", {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
}

async function discoverNineRouterModels(): Promise<{
  reachable: boolean;
  models: NineRouterModelInfo[];
}> {
  const res = await fetch("/provider-routing/nine-router/models");
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

function RegisteredModelsList({
  registered,
  loading,
  removingId,
  onRemove,
}: {
  registered: RegisteredModel[];
  loading: boolean;
  removingId: string | null;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-2 pt-2 border-t">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {m.provider_routing_registered_title()}
      </p>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : registered.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {m.provider_routing_registered_empty()}
        </p>
      ) : (
        <div
          className={`space-y-1.5 ${registered.length > 6 ? settingsScrollListClass : ""}`}
        >
          {registered.map((model) => (
            <div key={model.id} className={settingsRowClass}>
              <span className="text-sm font-mono truncate">{model.tag}</span>
              <Button
                variant="ghost"
                size="sm"
                className="px-2 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => onRemove(model.id)}
                disabled={removingId === model.id}
              >
                {removingId === model.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OllamaSection() {
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:11434");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [registered, setRegistered] = useState<RegisteredModel[]>([]);
  const [loadingRegistered, setLoadingRegistered] = useState(true);
  const [discovered, setDiscovered] = useState<OllamaModelInfo[] | null>(null);
  const [modelQuery, setModelQuery] = useState("");
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [registeringTag, setRegisteringTag] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runtime, setRuntime] = useState<OllamaRuntimeStatus | null>(null);
  const [installingRuntime, setInstallingRuntime] = useState(false);
  const installController = useRef<AbortController | null>(null);

  const loadRuntime = useCallback(async () => {
    try {
      setRuntime(await fetchOllamaRuntimeStatus());
    } catch {
      setRuntime(null);
    }
  }, []);

  const loadRegistered = useCallback(async () => {
    setLoadingRegistered(true);
    try {
      setRegistered(await fetchRegistered("ollama"));
    } catch {
      setError(m.provider_routing_error_load());
    } finally {
      setLoadingRegistered(false);
    }
  }, []);

  useEffect(() => {
    // Busca de dados ao montar (I/O de rede), não estado derivado de prop —
    // uso correto de efeito, ver justificativa em use-context-graph.ts.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadRegistered();
    void loadRuntime();
    void fetchOllamaConfig()
      .then((config) => {
        setBaseUrl(config.base_url);
        setApiKeyMasked(config.api_key_masked);
        setApiKeyConfigured(config.api_key_configured);
      })
      .catch(() => setError(m.provider_routing_error_load()));
  }, [loadRegistered, loadRuntime]);

  useEffect(() => {
    if (!installingRuntime) return;
    const timer = window.setInterval(() => {
      void fetchOllamaRuntimeStatus()
        .then(setRuntime)
        .catch(() => undefined);
    }, 700);
    return () => window.clearInterval(timer);
  }, [installingRuntime]);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setError(null);
    try {
      const config = await saveOllamaConfig(baseUrl, apiKey);
      setBaseUrl(config.base_url);
      setApiKey("");
      setApiKeyMasked(config.api_key_masked);
      setApiKeyConfigured(config.api_key_configured);
      await handleDiscover();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : m.provider_routing_ollama_error_config_save(),
      );
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setError(null);
    try {
      const response = await fetch("/provider-routing/ollama/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base_url: baseUrl, api_key: apiKey || null }),
      });
      if (!response.ok)
        throw new Error(
          await responseError(response, `Erro ${response.status}`),
        );
      const result = (await response.json()) as {
        status: string;
        models: OllamaModelInfo[];
      };
      setReachable(result.status === "ok" || result.status === "empty");
      setDiscovered(result.models);
      if (result.status === "auth_error")
        setError(m.provider_routing_ollama_auth_error());
      else if (result.status === "incompatible")
        setError(m.provider_routing_ollama_incompatible());
      else if (result.status === "unreachable")
        setError(m.provider_routing_ollama_unreachable());
    } catch (testError) {
      setError(
        testError instanceof Error
          ? testError.message
          : m.provider_routing_error_discover(),
      );
    } finally {
      setTestingConnection(false);
    }
  };

  const handleInstallRuntime = async () => {
    setInstallingRuntime(true);
    const controller = new AbortController();
    installController.current = controller;
    setError(null);
    try {
      setRuntime(await installOllamaRuntime(controller.signal));
      const data = await discoverModels();
      setReachable(data.reachable);
      setDiscovered(data.models);
    } catch (installError) {
      if (controller.signal.aborted) {
        await loadRuntime();
        return;
      }
      setError(
        installError instanceof Error
          ? installError.message
          : "Não foi possível instalar o Ollama",
      );
      await loadRuntime();
    } finally {
      installController.current = null;
      setInstallingRuntime(false);
    }
  };

  const handleStopRuntime = async () => {
    setError(null);
    try {
      const response = await fetch("/provider-routing/ollama/runtime/stop", {
        method: "POST",
      });
      if (!response.ok)
        throw new Error(
          await responseError(response, `Erro ${response.status}`),
        );
      setRuntime((await response.json()) as OllamaRuntimeStatus);
    } catch (stopError) {
      setError(
        stopError instanceof Error
          ? stopError.message
          : "Não foi possível parar o Ollama.",
      );
      await loadRuntime();
    }
  };

  const handleStartRuntime = async () => {
    setInstallingRuntime(true);
    setError(null);
    try {
      const response = await fetch("/provider-routing/ollama/runtime/start", {
        method: "POST",
      });
      if (!response.ok)
        throw new Error(
          await responseError(response, `Erro ${response.status}`),
        );
      setRuntime((await response.json()) as OllamaRuntimeStatus);
      const data = await discoverModels();
      setReachable(data.reachable);
      setDiscovered(data.models);
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Não foi possível iniciar o Ollama.",
      );
      await loadRuntime();
    } finally {
      setInstallingRuntime(false);
    }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    setError(null);
    try {
      const data = await discoverModels();
      setReachable(data.reachable);
      setDiscovered(data.models);
    } catch {
      setReachable(false);
      setDiscovered([]);
      setError(m.provider_routing_error_discover());
    } finally {
      setDiscovering(false);
    }
  };

  const handleRegister = async (tag: string) => {
    setRegisteringTag(tag);
    setError(null);
    try {
      await registerModel("ollama", tag);
      await loadRegistered();
    } catch {
      setError(m.provider_routing_error_register());
    } finally {
      setRegisteringTag(null);
    }
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    setError(null);
    try {
      await unregisterModel("ollama", id);
      setRegistered((prev) => prev.filter((model) => model.id !== id));
    } catch {
      setError(m.provider_routing_error_remove());
    } finally {
      setRemovingId(null);
    }
  };

  const registeredTags = new Set(registered.map((model) => model.tag));
  const filteredDiscovered = discovered?.filter((model) =>
    model.name.toLowerCase().includes(modelQuery.trim().toLowerCase()),
  );

  return (
    <div className={settingsSectionClass}>
      <SettingsSectionHeader
        icon={<ProviderIcon provider="ollama" className="size-3.5" />}
        title={m.provider_routing_ollama_title()}
        description={m.provider_routing_ollama_subtitle()}
      />

      {error && <SettingsMessage tone="danger">{error}</SettingsMessage>}

      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs">
        <span>
          {m.provider_routing_ollama_label()}{" "}
          {runtime?.state === "running"
            ? m.provider_routing_ollama_runtime_running()
            : runtime?.installed
              ? m.provider_routing_ollama_runtime_installed()
              : m.provider_routing_ollama_runtime_missing()}
          {runtime?.version ? ` (${runtime.version})` : ""}
          {runtime?.phase && runtime.phase !== "idle"
            ? ` · ${runtime.phase}`
            : ""}
        </span>
        {!runtime?.installed && runtime?.state !== "running" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleInstallRuntime()}
            disabled={installingRuntime}
          >
            {installingRuntime ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : null}
            {installingRuntime
              ? m.provider_routing_ollama_installing()
              : m.provider_routing_ollama_install()}
          </Button>
        )}
        {runtime?.installed && runtime.state !== "running" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleStartRuntime()}
            disabled={installingRuntime}
          >
            {installingRuntime ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : null}
            {installingRuntime
              ? m.provider_routing_ollama_starting()
              : m.provider_routing_ollama_start()}
          </Button>
        )}
        {runtime?.state === "running" && runtime.managed && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleStopRuntime()}
          >
            {m.provider_routing_ollama_stop()}
          </Button>
        )}
      </div>
      {installingRuntime && (
        <div className="space-y-1.5" role="status">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {runtime?.phase === "download" && runtime.download_total
                ? `Baixando Ollama: ${Math.min(100, Math.floor(((runtime.downloaded ?? 0) / runtime.download_total) * 100))}%`
                : runtime?.phase === "start"
                  ? m.provider_routing_ollama_starting()
                  : `Instalando Ollama · ${runtime?.phase ?? "detect"}`}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => installController.current?.abort()}
            >
              {m.provider_routing_runtime_cancel()}
            </Button>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            {runtime?.phase === "download" && runtime.download_total ? (
              <div
                className="h-full bg-primary transition-[width]"
                style={{
                  width: `${Math.min(100, ((runtime.downloaded ?? 0) / runtime.download_total) * 100)}%`,
                }}
              />
            ) : (
              <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label={m.provider_routing_ollama_key()}
          type="password"
          autoComplete="new-password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={
            apiKeyConfigured
              ? apiKeyMasked
              : m.provider_routing_ollama_key_placeholder()
          }
        />
        <Button
          size="sm"
          type="button"
          disabled={savingConfig || testingConnection}
          onClick={() => void handleSaveConfig()}
        >
          {savingConfig ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : null}
          {m.provider_routing_dmr_save()}
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label={m.provider_routing_ollama_endpoint()}
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder={m.provider_routing_ollama_endpoint_placeholder()}
        />
        <Button
          size="sm"
          type="button"
          variant="outline"
          disabled={testingConnection || savingConfig}
          onClick={() => void handleTestConnection()}
        >
          {testingConnection ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : null}
          {m.provider_routing_dmr_test()}
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={modelQuery}
            onChange={(event) => setModelQuery(event.target.value)}
            placeholder={m.provider_routing_nine_router_search_placeholder()}
            className="h-8 pl-8 text-xs"
            autoComplete="off"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => void handleDiscover()}
          disabled={discovering}
        >
          {discovering ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          )}
          {m.provider_routing_detect_models()}
        </Button>
      </div>

      <div className="space-y-2">
        {reachable === false && (
          <p className="text-xs text-muted-foreground">
            {m.provider_routing_ollama_unreachable()}
          </p>
        )}

        {filteredDiscovered &&
          filteredDiscovered.length === 0 &&
          discovered &&
          discovered.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {m.provider_routing_nine_router_search_empty()}
            </p>
          )}
        {filteredDiscovered && filteredDiscovered.length > 0 && (
          <div className={cn("space-y-1.5", settingsScrollListClass)}>
            {filteredDiscovered.map((model) => {
              const already = registeredTags.has(model.name);
              return (
                <div key={model.name} className={settingsRowClass}>
                  <span className="text-sm font-mono truncate">
                    {model.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-2 shrink-0"
                    onClick={() => void handleRegister(model.name)}
                    disabled={already || registeringTag === model.name}
                  >
                    {registeringTag === model.name ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : already ? (
                      m.provider_routing_already_registered()
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        {m.provider_routing_register()}
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <RegisteredModelsList
        registered={registered}
        loading={loadingRegistered}
        removingId={removingId}
        onRemove={(id) => void handleRemove(id)}
      />
    </div>
  );
}

function OpenRouterSection() {
  const [status, setStatus] = useState<OpenRouterStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [keyInput, setKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [removingKey, setRemovingKey] = useState(false);
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<OpenRouterModelInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [registered, setRegistered] = useState<RegisteredModel[]>([]);
  const [loadingRegistered, setLoadingRegistered] = useState(true);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      setStatus(await fetchOpenRouterStatus());
    } catch {
      setError(m.provider_routing_openrouter_error_status());
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const loadRegistered = useCallback(async () => {
    setLoadingRegistered(true);
    try {
      setRegistered(await fetchRegistered("openrouter"));
    } catch {
      setError(m.provider_routing_error_load());
    } finally {
      setLoadingRegistered(false);
    }
  }, []);

  useEffect(() => {
    // Busca de dados ao montar (I/O de rede), não estado derivado de prop —
    // uso correto de efeito, ver justificativa em use-context-graph.ts.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadStatus();
    void loadRegistered();
  }, [loadStatus, loadRegistered]);

  // Busca com debounce — catálogo é cacheado no backend (~1h), seguro
  // consultar a cada pausa de digitação em vez de exigir um botão.
  useEffect(() => {
    if (!status?.configured) return;
    const handle = setTimeout(() => {
      setSearching(true);
      searchOpenRouterCatalog(query)
        .then(setCatalog)
        .catch(() => setError(m.provider_routing_openrouter_error_catalog()))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, status?.configured]);

  const handleSaveKey = async () => {
    if (!keyInput.trim()) return;
    setSavingKey(true);
    setError(null);
    try {
      setStatus(await saveOpenRouterKey(keyInput.trim()));
      setKeyInput("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : m.provider_routing_openrouter_error_key_save(),
      );
    } finally {
      setSavingKey(false);
    }
  };

  const handleRemoveKey = async () => {
    setRemovingKey(true);
    setError(null);
    try {
      await removeOpenRouterKey();
      setStatus({ configured: false, masked: "" });
      setCatalog([]);
    } catch {
      setError(m.provider_routing_openrouter_error_key_remove());
    } finally {
      setRemovingKey(false);
    }
  };

  const handleDiscover = async () => {
    setSearching(true);
    setError(null);
    try {
      setCatalog(await searchOpenRouterCatalog(query));
    } catch {
      setError(m.provider_routing_openrouter_error_catalog());
    } finally {
      setSearching(false);
    }
  };

  const handleRegister = async (id: string) => {
    setRegisteringId(id);
    setError(null);
    try {
      await registerModel("openrouter", id);
      await loadRegistered();
    } catch {
      setError(m.provider_routing_error_register());
    } finally {
      setRegisteringId(null);
    }
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    setError(null);
    try {
      await unregisterModel("openrouter", id);
      setRegistered((prev) => prev.filter((model) => model.id !== id));
    } catch {
      setError(m.provider_routing_error_remove());
    } finally {
      setRemovingId(null);
    }
  };

  const registeredTags = new Set(registered.map((model) => model.tag));

  return (
    <div className={settingsSectionClass}>
      <SettingsSectionHeader
        icon={<ProviderIcon provider="openrouter" className="size-3.5" />}
        title={m.provider_routing_openrouter_title()}
        description={m.provider_routing_openrouter_subtitle()}
      />

      {error && <SettingsMessage tone="danger">{error}</SettingsMessage>}

      {/* Key */}
      {loadingStatus ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : status?.configured ? (
        <div className={settingsRowClass}>
          <div className="flex items-center gap-1.5 text-xs">
            <SettingsStatus tone="success">
              {m.provider_routing_openrouter_key_configured()}
            </SettingsStatus>
            <span className="font-mono text-muted-foreground">
              {status.masked}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="px-2 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => void handleRemoveKey()}
            disabled={removingKey}
          >
            {removingKey ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              m.provider_routing_openrouter_key_remove()
            )}
          </Button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <Input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder={m.provider_routing_openrouter_key_placeholder()}
            className="h-8 text-xs font-mono flex-1"
            autoComplete="off"
          />
          <Button
            size="sm"
            onClick={() => void handleSaveKey()}
            disabled={savingKey || !keyInput.trim()}
          >
            {savingKey ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              m.provider_routing_openrouter_key_save()
            )}
          </Button>
        </div>
      )}

      {/* Catálogo */}
      {status?.configured && (
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={m.provider_routing_openrouter_search_placeholder()}
                className="h-8 text-xs pl-8"
                autoComplete="off"
              />
              {searching && (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => void handleDiscover()}
              disabled={searching}
            >
              {searching ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 size-3.5" />
              )}
              {m.provider_routing_detect_models()}
            </Button>
          </div>

          {catalog.length > 0 && (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {catalog.map((model) => {
                const already = registeredTags.has(model.id);
                return (
                  <div key={model.id} className={settingsRowClass}>
                    <span className="text-sm font-mono truncate">
                      {model.id}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-2 shrink-0"
                      onClick={() => void handleRegister(model.id)}
                      disabled={already || registeringId === model.id}
                    >
                      {registeringId === model.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : already ? (
                        m.provider_routing_already_registered()
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          {m.provider_routing_register()}
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <RegisteredModelsList
        registered={registered}
        loading={loadingRegistered}
        removingId={removingId}
        onRemove={(id) => void handleRemove(id)}
      />
    </div>
  );
}

function NineRouterSection() {
  const [status, setStatus] = useState<NineRouterStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [baseUrlInput, setBaseUrlInput] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [removingConfig, setRemovingConfig] = useState(false);
  const [discovered, setDiscovered] = useState<NineRouterModelInfo[] | null>(
    null,
  );
  const [modelQuery, setModelQuery] = useState("");
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [registered, setRegistered] = useState<RegisteredModel[]>([]);
  const [loadingRegistered, setLoadingRegistered] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      setStatus(await fetchNineRouterStatus());
    } catch {
      setError(m.provider_routing_nine_router_error_status());
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const loadRegistered = useCallback(async () => {
    setLoadingRegistered(true);
    try {
      setRegistered(await fetchRegistered("nine-router"));
    } catch {
      setError(m.provider_routing_error_load());
    } finally {
      setLoadingRegistered(false);
    }
  }, []);

  useEffect(() => {
    // Busca de dados ao montar (I/O de rede), não estado derivado de prop —
    // uso correto de efeito, ver justificativa em use-context-graph.ts.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadStatus();
    void loadRegistered();
  }, [loadStatus, loadRegistered]);

  // Detecção automática assim que o proxy está configurado — igual ao
  // OpenRouter, que busca no catálogo sem exigir clique em botão. Só roda
  // uma vez por configuração (discovered !== null trava o re-disparo); o
  // botão "Detectar modelos" continua disponível pra atualizar manualmente.
  useEffect(() => {
    if (!status?.configured || discovered !== null) return;
    // oxlint-disable-next-line react/set-state-in-effect
    setDiscovering(true);
    setError(null);
    discoverNineRouterModels()
      .then((data) => {
        setReachable(data.reachable);
        setDiscovered(data.models);
      })
      .catch(() => {
        setReachable(false);
        setDiscovered([]);
        setError(m.provider_routing_error_discover());
      })
      .finally(() => setDiscovering(false));
  }, [status?.configured, discovered]);

  const handleSaveConfig = async () => {
    if (!baseUrlInput.trim() || !keyInput.trim()) return;
    setSavingConfig(true);
    setError(null);
    try {
      setStatus(
        await saveNineRouterConfig(baseUrlInput.trim(), keyInput.trim()),
      );
      setBaseUrlInput("");
      setKeyInput("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : m.provider_routing_nine_router_error_config_save(),
      );
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRemoveConfig = async () => {
    setRemovingConfig(true);
    setError(null);
    try {
      await removeNineRouterConfig();
      setStatus({ configured: false, base_url: null, masked: "" });
      setDiscovered(null);
      setReachable(null);
    } catch {
      setError(m.provider_routing_nine_router_error_config_remove());
    } finally {
      setRemovingConfig(false);
    }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    setError(null);
    setModelQuery("");
    try {
      const data = await discoverNineRouterModels();
      setReachable(data.reachable);
      setDiscovered(data.models);
    } catch {
      setReachable(false);
      setDiscovered([]);
      setError(m.provider_routing_error_discover());
    } finally {
      setDiscovering(false);
    }
  };

  const handleRegister = async (id: string) => {
    setRegisteringId(id);
    setError(null);
    try {
      await registerModel("nine-router", id);
      await loadRegistered();
    } catch {
      setError(m.provider_routing_error_register());
    } finally {
      setRegisteringId(null);
    }
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    setError(null);
    try {
      await unregisterModel("nine-router", id);
      setRegistered((prev) => prev.filter((model) => model.id !== id));
    } catch {
      setError(m.provider_routing_error_remove());
    } finally {
      setRemovingId(null);
    }
  };

  const registeredTags = new Set(registered.map((model) => model.tag));
  const filteredDiscovered =
    discovered?.filter((model) =>
      model.id.toLowerCase().includes(modelQuery.trim().toLowerCase()),
    ) ?? null;

  return (
    <div className={settingsSectionClass}>
      <SettingsSectionHeader
        icon={<ProviderIcon provider="nine_router" className="size-3.5" />}
        title={m.provider_routing_nine_router_title()}
        description={m.provider_routing_nine_router_subtitle()}
      />

      {error && <SettingsMessage tone="danger">{error}</SettingsMessage>}

      {/* Endpoint + key */}
      {loadingStatus ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : status?.configured ? (
        <div className={settingsRowClass}>
          <div className="flex items-center gap-1.5 text-xs min-w-0">
            <SettingsStatus tone="success" className="shrink-0">
              {m.provider_routing_nine_router_configured()}
            </SettingsStatus>
            <span className="font-mono text-muted-foreground truncate">
              {status.base_url} · {status.masked}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="px-2 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => void handleRemoveConfig()}
            disabled={removingConfig}
          >
            {removingConfig ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              m.provider_routing_nine_router_config_remove()
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Input
            value={baseUrlInput}
            onChange={(e) => setBaseUrlInput(e.target.value)}
            placeholder={m.provider_routing_nine_router_base_url_placeholder()}
            className="h-8 text-xs font-mono"
            autoComplete="off"
          />
          <div className="flex gap-1.5">
            <Input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={m.provider_routing_nine_router_key_placeholder()}
              className="h-8 text-xs font-mono flex-1"
              autoComplete="off"
            />
            <Button
              size="sm"
              onClick={() => void handleSaveConfig()}
              disabled={
                savingConfig || !baseUrlInput.trim() || !keyInput.trim()
              }
            >
              {savingConfig ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                m.provider_routing_nine_router_config_save()
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Descoberta */}
      {status?.configured && (
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={modelQuery}
                onChange={(e) => setModelQuery(e.target.value)}
                placeholder={m.provider_routing_nine_router_search_placeholder()}
                className="h-8 text-xs pl-8"
                autoComplete="off"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => void handleDiscover()}
              disabled={discovering}
            >
              {discovering ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              )}
              {m.provider_routing_detect_models()}
            </Button>
          </div>
          {reachable === false && (
            <p className="text-xs text-muted-foreground">
              {m.provider_routing_nine_router_unreachable()}
            </p>
          )}

          {discovered && discovered.length > 0 && (
            <div className="space-y-2">
              {filteredDiscovered && filteredDiscovered.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {m.provider_routing_nine_router_search_empty()}
                </p>
              ) : (
                <div className={cn("space-y-1.5", settingsScrollListClass)}>
                  {(filteredDiscovered ?? discovered).map((model) => {
                    const already = registeredTags.has(model.id);
                    return (
                      <div key={model.id} className={settingsRowClass}>
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-mono text-sm">
                            {model.id}
                          </span>
                          {model.provider ? (
                            <SettingsStatus className="shrink-0">
                              {model.provider}
                            </SettingsStatus>
                          ) : null}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="px-2 shrink-0"
                          onClick={() => void handleRegister(model.id)}
                          disabled={already || registeringId === model.id}
                        >
                          {registeringId === model.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : already ? (
                            m.provider_routing_already_registered()
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5 mr-1" />
                              {m.provider_routing_register()}
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <RegisteredModelsList
        registered={registered}
        loading={loadingRegistered}
        removingId={removingId}
        onRemove={(id) => void handleRemove(id)}
      />
    </div>
  );
}

/** Modelos de imagem/TTS para os providers de gateway.
 *
 * Config por gateway (Ollama/OpenRouter), mesma natureza dos modelos LLM
 * registrados acima — não uma preferência genérica de usuário.
 *
 * Só Ollama e OpenRouter aparecem aqui: Gemini/OpenAI resolvem a capacidade
 * sozinhos pelo catálogo (`PROVIDER_CAPABILITIES`) e não têm o que escolher.
 * Campo vazio devolve o controle pra env var correspondente, se houver —
 * não desliga a capacidade. */
export function MediaModelsSection() {
  const [models, setModels] = useState<Record<string, string>>({});
  const [speechModels, setSpeechModels] = useState<
    Array<{ id: string; name: string; voices: string[] }>
  >([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/admin/speech-models");
        if (!res.ok || !alive) return;
        const data = (await res.json()) as {
          models?: Array<{ id: string; name: string; voices: string[] }>;
        };
        if (alive) setSpeechModels(data.models ?? []);
      } catch {
        if (alive) setSpeechModels([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/admin/media-models");
        if (!res.ok || !alive) return;
        const data = (await res.json()) as { models?: Record<string, string> };
        if (alive) setModels(data.models ?? {});
      } catch {
        if (alive) setModels({});
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function handleSave(key: string, value: string) {
    setError("");
    try {
      const res = await fetch("/admin/media-models", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { models?: Record<string, string> };
      // Repinta com o valor EFETIVO devolvido pelo backend: se o campo foi
      // limpo e existe env var, o que passa a valer é a env — mostrar o campo
      // vazio faria parecer que a capacidade ficou desligada.
      setModels(data.models ?? {});
    } catch {
      setError(m.prefs_media_models_error());
    }
  }

  const campos: { key: string; label: string }[] = [
    { key: "ollama_image_model", label: m.prefs_media_models_ollama_image() },
    { key: "ollama_tts_model", label: m.prefs_media_models_ollama_tts() },
    {
      key: "ollama_video_model",
      label: mDyn("prefs_media_models_ollama_video"),
    },
    {
      key: "openrouter_image_model",
      label: m.prefs_media_models_openrouter_image(),
    },
    {
      key: "openrouter_tts_model",
      label: m.prefs_media_models_openrouter_tts(),
    },
    {
      key: "openrouter_video_model",
      label: mDyn("prefs_media_models_openrouter_video"),
    },
  ];

  return (
    <div className="space-y-3">
      <Label>{m.prefs_media_models_section()}</Label>
      <p className="text-xs text-muted-foreground">
        {m.prefs_media_models_hint()}
      </p>
      {campos.map(({ key, label }) => (
        <div key={key} className="flex items-center justify-between gap-3">
          <Label htmlFor={key} className="text-xs font-normal">
            {label}
          </Label>
          <Input
            id={key}
            className="w-[240px]"
            value={models[key] ?? ""}
            autoComplete="off"
            list={
              key === "openrouter_tts_model"
                ? "openrouter-speech-models"
                : undefined
            }
            onChange={(e) =>
              setModels((prev) => ({ ...prev, [key]: e.target.value }))
            }
            onBlur={(e) => void handleSave(key, e.target.value)}
          />
        </div>
      ))}
      <datalist id="openrouter-speech-models">
        {speechModels.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </datalist>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function LlamaCppSection() {
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:18080/v1");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<LlamaCppModelInfo[]>([]);
  const [registered, setRegistered] = useState<RegisteredModel[]>([]);
  const [loadingRegistered, setLoadingRegistered] = useState(true);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [modelQuery, setModelQuery] = useState("");
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [runtimeBusy, setRuntimeBusy] = useState(false);
  const [installingRuntime, setInstallingRuntime] = useState(false);
  const [runtimeProgress, setRuntimeProgress] = useState(0);
  const [error, setError] = useState("");
  const [runtime, setRuntime] = useState<LlamaCppRuntimeStatus | null>(null);

  const refreshRuntime = useCallback(async () => {
    try {
      const [runtimeStatus, configResponse] = await Promise.all([
        fetchLlamaCppRuntimeStatus(),
        fetch("/provider-routing/llamacpp/status"),
      ]);
      setRuntime(runtimeStatus);
      if (configResponse.ok) {
        const config = (await configResponse.json()) as { base_url?: string };
        setBaseUrl(config.base_url ?? "http://127.0.0.1:18080/v1");
      }
    } catch {
      setRuntime(null);
    }
  }, []);

  const loadRegistered = useCallback(async () => {
    setLoadingRegistered(true);
    try {
      setRegistered(await fetchRegistered("llamacpp"));
    } catch {
      setError(m.provider_routing_error_load());
    } finally {
      setLoadingRegistered(false);
    }
  }, []);

  useEffect(() => {
    // Carrega o status e o catálogo já habilitado no seletor.
    // oxlint-disable-next-line react/set-state-in-effect
    void refreshRuntime();
    void loadRegistered();
  }, [loadRegistered, refreshRuntime]);

  useEffect(() => {
    if (!installingRuntime) return;
    const timer = window.setInterval(() => {
      void fetchLlamaCppRuntimeStatus().then((status) => {
        setRuntime(status);
        const progress = status.install_progress;
        if (progress?.total && progress.total > 0) {
          setRuntimeProgress(
            Math.min(
              100,
              Math.floor(((progress.downloaded ?? 0) / progress.total) * 100),
            ),
          );
        }
      });
    }, 700);
    return () => window.clearInterval(timer);
  }, [installingRuntime]);

  async function installRuntime() {
    setInstallingRuntime(true);
    setRuntimeProgress(0);
    setError("");
    try {
      const releasesResponse = await fetch(
        "/provider-routing/llamacpp/releases",
      );
      if (!releasesResponse.ok)
        throw new Error(`Erro ${releasesResponse.status}`);
      const releases = (await releasesResponse.json()) as {
        releases?: Array<{
          assets?: Array<{ url: string; sha256: string; recommended: boolean }>;
        }>;
      };
      const asset = releases.releases
        ?.flatMap((release) => release.assets ?? [])
        .find((candidate) => candidate.recommended && candidate.sha256);
      if (!asset)
        throw new Error(
          "Não há um runtime oficial compatível com este dispositivo.",
        );
      const response = await fetch("/provider-routing/llamacpp/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset_url: asset.url, sha256: asset.sha256 }),
      });
      if (!response.ok)
        throw new Error(
          await responseError(response, `Erro ${response.status}`),
        );
      await refreshRuntime();
    } catch (installError) {
      setError(
        installError instanceof Error
          ? installError.message
          : "Falha ao instalar llama.cpp.",
      );
    } finally {
      setInstallingRuntime(false);
    }
  }

  async function saveConfig() {
    setError("");
    try {
      const response = await fetch("/provider-routing/llamacpp/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base_url: baseUrl, api_key: apiKey }),
      });
      if (!response.ok)
        throw new Error(
          await responseError(response, `Erro ${response.status}`),
        );
      setApiKey("");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Erro ao salvar a configuração do llama.cpp",
      );
    }
  }

  async function detectModels() {
    setLoading(true);
    setError("");
    try {
      const result = await discoverLlamaCppModels();
      setReachable(result.reachable);
      setModels(result.models);
    } catch {
      setReachable(false);
      setModels([]);
      setError("Erro ao consultar o llama.cpp");
    } finally {
      setLoading(false);
    }
  }

  async function testConnection() {
    setLoading(true);
    setError("");
    try {
      const result = await testLlamaCppConnection();
      setReachable(result.status === "ok" || result.status === "empty");
      if (result.models) setModels(result.models);
      if (result.status !== "ok" && result.status !== "empty")
        setError(`Status: ${result.status}`);
    } catch {
      setReachable(false);
      setError("Erro ao testar o llama.cpp");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(id: string) {
    setRegisteringId(id);
    setError("");
    try {
      await registerModel("llamacpp", id);
      await loadRegistered();
    } catch {
      setError(m.provider_routing_error_register());
    } finally {
      setRegisteringId(null);
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    setError("");
    try {
      await unregisterModel("llamacpp", id);
      setRegistered((current) => current.filter((item) => item.id !== id));
    } catch {
      setError(m.provider_routing_error_remove());
    } finally {
      setRemovingId(null);
    }
  }

  async function runtimeAction(action: "start" | "stop" | "remove") {
    setRuntimeBusy(true);
    setError("");
    try {
      if (action === "start") {
        const response = await fetch(
          "/provider-routing/llamacpp/runtime/start",
          {
            method: "POST",
          },
        );
        if (!response.ok)
          throw new Error(
            await responseError(response, `Erro ${response.status}`),
          );
      } else if (action === "remove") {
        const response = await fetch("/provider-routing/llamacpp/runtime", {
          method: "DELETE",
        });
        if (!response.ok)
          throw new Error(
            await responseError(response, `Erro ${response.status}`),
          );
      } else {
        const response = await fetch(
          "/provider-routing/llamacpp/sidecar/stop",
          { method: "POST" },
        );
        if (!response.ok)
          throw new Error(
            await responseError(response, `Erro ${response.status}`),
          );
      }
      await refreshRuntime();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Não foi possível concluir a ação do runtime.",
      );
    } finally {
      setRuntimeBusy(false);
    }
  }

  const registeredByTag = new Map(registered.map((item) => [item.tag, item]));
  const modelRows = new Map<string, LlamaCppModelInfo>();
  for (const item of models) modelRows.set(item.id, item);
  for (const item of registered) {
    if (!modelRows.has(item.tag)) modelRows.set(item.tag, { id: item.tag });
  }
  const filteredModels = [...modelRows.values()].filter((item) =>
    item.id.toLowerCase().includes(modelQuery.trim().toLowerCase()),
  );

  return (
    <div className={settingsSectionClass}>
      <SettingsSectionHeader
        icon={<ProviderIcon provider="llamacpp" className="size-3.5" />}
        title={m.provider_routing_llamacpp_title()}
        description={m.provider_routing_llamacpp_subtitle()}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-base text-muted-foreground">
          {m.provider_routing_llamacpp_status({
            status: runtime?.reachable
              ? m.provider_routing_ollama_runtime_running()
              : runtime?.installed
                ? m.provider_routing_llamacpp_runtime_installed()
                : m.provider_routing_ollama_runtime_missing(),
          })}
        </span>
        <div className="flex gap-2">
          {!runtime?.installed && (
            <Button
              size="sm"
              type="button"
              variant="outline"
              disabled={installingRuntime}
              onClick={() => void installRuntime()}
            >
              {installingRuntime ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : null}
              {m.provider_routing_llamacpp_install()}
            </Button>
          )}
          {runtime?.installed &&
            !runtime.reachable &&
            runtime.external !== true && (
              <Button
                size="sm"
                type="button"
                variant="outline"
                disabled={runtimeBusy}
                onClick={() => void runtimeAction("start")}
              >
                {m.provider_routing_llamacpp_start()}
              </Button>
            )}
          {runtime?.installed && runtime.external !== true && (
            <Button
              size="sm"
              type="button"
              variant="outline"
              disabled={runtimeBusy}
              onClick={() => void runtimeAction("remove")}
            >
              {m.provider_routing_llamacpp_uninstall()}
            </Button>
          )}
          {runtime?.reachable && runtime.external !== true && (
            <Button
              size="sm"
              type="button"
              variant="outline"
              disabled={runtimeBusy}
              onClick={() => void runtimeAction("stop")}
            >
              {m.provider_routing_llamacpp_stop()}
            </Button>
          )}
        </div>
      </div>
      {installingRuntime && (
        <div className="space-y-1.5" role="status">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {runtime?.install_progress?.phase === "extract"
                ? "Preparando runtime…"
                : `Baixando runtime: ${runtimeProgress}%`}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={runtime?.install_progress?.phase === "extract"}
              onClick={() => void cancelLlamaCppRuntimeInstall()}
            >
              {m.provider_routing_runtime_cancel()}
            </Button>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width]"
              style={{ width: `${runtimeProgress}%` }}
            />
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <Input
          aria-label={m.provider_routing_llamacpp_key()}
          type="password"
          autoComplete="new-password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={m.provider_routing_llamacpp_key_placeholder()}
        />
        <Button size="sm" type="button" onClick={() => void saveConfig()}>
          {m.provider_routing_dmr_save()}
        </Button>
      </div>
      <div className="flex gap-2">
        <Input
          aria-label={m.provider_routing_llamacpp_endpoint()}
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder={m.provider_routing_llamacpp_endpoint_placeholder()}
        />
        <Button
          size="sm"
          type="button"
          variant="outline"
          disabled={loading}
          onClick={() => void testConnection()}
        >
          {m.provider_routing_llamacpp_test()}
        </Button>
      </div>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={modelQuery}
            onChange={(event) => setModelQuery(event.target.value)}
            placeholder={m.provider_routing_nine_router_search_placeholder()}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Button
          size="sm"
          type="button"
          variant="outline"
          disabled={loading}
          onClick={() => void detectModels()}
        >
          {loading ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 size-4" />
          )}
          {m.provider_routing_detect_models()}
        </Button>
      </div>
      {reachable === false && (
        <p className="text-xs text-muted-foreground">
          {m.provider_routing_llamacpp_unreachable()}
        </p>
      )}
      <div
        className={
          filteredModels.length > 6
            ? cn("space-y-2", settingsScrollListClass)
            : "space-y-2"
        }
      >
        {filteredModels.map((item) => {
          const registeredModel = registeredByTag.get(item.id);
          return (
            <div key={item.id} className={cn(settingsRowClass, "min-w-0")}>
              <span className="truncate font-mono text-sm">{item.id}</span>
              {registeredModel ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {m.provider_routing_already_registered()}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={m.provider_routing_llamacpp_remove_model({
                      model: item.id,
                    })}
                    disabled={removingId === registeredModel.id}
                    onClick={() => void handleRemove(registeredModel.id)}
                  >
                    {removingId === registeredModel.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={registeringId === item.id}
                  onClick={() => void handleRegister(item.id)}
                >
                  {registeringId === item.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="mr-1 size-3.5" />
                      {m.provider_routing_register()}
                    </>
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {loadingRegistered && (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ProviderRoutingTab() {
  return (
    <SettingsStack>
      <SettingsPageNav />
      <LlamaCppSection />
      <OllamaSection />
      <DmrSection />
      <HuggingFaceCatalogSection />
      <OpenRouterSection />
      <NineRouterSection />
    </SettingsStack>
  );
}
