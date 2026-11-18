"use client";

import { ImageFallbackModelSection } from "./image-model-section";
import { ProviderIcon } from "@/components/icons/provider-icons";
import { useCallback, useEffect, useState } from "react";
import {
  hydrateDecisionModelPreferences,
  useSettingsStore,
  type DecisionModelProvider,
} from "@/lib/stores/settings-store";
import { useWorkspacesStore } from "@/lib/stores/workspaces-store";
import { m } from "@/lib/paraglide/messages";
import { mDyn } from "@/lib/i18n-dyn";
import {
  getAllowedModels,
  getModelDisplayName,
  getModelProvider,
} from "@/lib/config/deployment-config";
import { Button } from "@/components/ui/button";
import { useRagSettings } from "@/components/workbench/rag-settings-panel";

function RetrievalModelSettings() {
  const state = useRagSettings({ autoLoad: true });
  return (
    <div className="space-y-4">
      <CapabilityModelList
        capability="embedding"
        title={mDyn("ai_models_embeddings_title")}
        description={mDyn("ai_models_embeddings_card_description")}
        selected={state.settings.embed_model}
        onSelect={(model) => void state.patch({ embed_model: model })}
      />
      <CapabilityModelList
        capability="reranking"
        title={mDyn("ai_models_rerankers_title")}
        description={mDyn("ai_models_rerankers_card_description")}
        selected={state.settings.rerank_model}
        onSelect={(model) => void state.patch({ rerank_model: model })}
        enabled={state.settings.reranker_enabled}
        onToggle={() =>
          void state.patch({
            reranker_enabled: !state.settings.reranker_enabled,
          })
        }
      />
    </div>
  );
}

type CatalogModel = {
  id: string;
  name: string;
  provider: string;
  capabilities: string[];
};

function providerFromModelId(modelId: string): string {
  return modelId.includes(":")
    ? modelId.slice(0, modelId.indexOf(":"))
    : "auto";
}

function CapabilityModelList({
  capability,
  title,
  description,
  selected,
  onSelect,
  enabled,
  onToggle,
}: {
  capability: "embedding" | "reranking";
  title: string;
  description: string;
  selected: string;
  onSelect: (id: string) => void;
  enabled?: boolean;
  onToggle?: () => void;
}) {
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    void fetch(`/models/catalog?capability=${capability}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as { models?: CatalogModel[] };
      })
      .then((data) => {
        if (alive) setModels(data.models ?? []);
      })
      .catch(() => {
        if (alive) setModels([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [capability]);
  const current = models.find((model) => model.id === selected);
  const options = models.filter((model) => model.id !== selected);
  return (
    <section className="space-y-3 rounded-lg border bg-[#1f1f1f] p-3">
      <div>
        <h4 className="text-sm font-medium">{title}</h4>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {onToggle && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            {title}:{" "}
            {enabled ? mDyn("ai_models_enabled") : mDyn("ai_models_disabled")}
          </span>
          <Button type="button" variant="outline" onClick={onToggle}>
            {enabled
              ? mDyn("ai_models_disable_rerankers")
              : mDyn("ai_models_enable_rerankers")}
          </Button>
        </div>
      )}
      {selected && (
        <div className="flex items-center justify-between rounded-lg border bg-[#1a1a1a] px-3 py-2">
          <span className="flex min-w-0 items-center gap-2 truncate text-sm">
            <ProviderIcon
              provider={current?.provider ?? providerFromModelId(selected)}
              className="size-4 shrink-0"
            />
            {current?.name ?? selected}
          </span>
          <span className="text-sm font-medium">
            {m.provider_routing_already_registered()}
          </span>
        </div>
      )}
      {loading ? (
        <p className="text-xs text-muted-foreground">
          {m.workbench_settings_loading()}
        </p>
      ) : options.length ? (
        <div
          className={`grid gap-2 md:grid-cols-2 xl:grid-cols-3 ${options.length > 6 ? "max-h-[26rem] overflow-y-auto pr-1" : ""}`}
        >
          {options.map((model) => (
            <div
              key={model.id}
              className="flex min-w-0 items-center justify-between gap-2 rounded-lg border bg-[#1a1a1a] px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2 truncate text-sm">
                <ProviderIcon
                  provider={model.provider}
                  className="size-4 shrink-0"
                />
                <span className="truncate">{model.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {model.provider}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                onClick={() => onSelect(model.id)}
              >
                {m.provider_routing_register()}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {mDyn("ai_models_no_models_for_capability")}
        </p>
      )}
    </section>
  );
}

const DECISION_PROVIDERS: Array<{ id: DecisionModelProvider; label: string }> =
  [
    { id: "clef-local", label: "ai_models_provider_clef_local" },
    { id: "laya-local", label: "ai_models_provider_laya_local" },
    { id: "clef-api", label: "ai_models_provider_clef_api" },
    { id: "jev-api", label: "ai_models_provider_jev_api" },
  ];

const DECISION_SURFACES = [
  ["hitl", "ai_models_surface_hitl"],
  ["subagents", "ai_models_surface_subagents"],
  ["plan_mode", "ai_models_surface_plan_mode"],
  ["kanban", "ai_models_surface_kanban"],
  ["browser", "ai_models_surface_browser"],
  ["mcp", "ai_models_surface_mcp"],
  ["terminal", "ai_models_surface_terminal"],
  ["network", "ai_models_surface_network"],
  ["background", "ai_models_surface_background"],
  ["connectors", "ai_models_surface_connectors"],
] as const;

interface DecisionStatus {
  model: string;
  ready: boolean;
  configured: boolean;
  credential_valid: boolean | null;
  healthy: boolean;
  diagnostic?: string | null;
}

interface SystemOneConfig {
  enabled: boolean;
  provider: string;
  local_base_url: string;
  local_model: string;
  laya_base_url: string;
  laya_model: string;
  laya_api_key_configured: boolean;
  clef_api_base_url: string;
  clef_account_id: string;
  clef_api_model: string;
  clef_api_key_configured: boolean;
  jev_api_base_url: string;
  jev_api_model: string;
  jev_api_key_configured: boolean;
  allow_remote_fallback: boolean;
  confidence_threshold_hitl: number;
  risk_assessment_timeout_s: number;
}

export function SystemOneConfiguration() {
  const [config, setConfig] = useState<SystemOneConfig | null>(null);
  const [secret, setSecret] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const selected = config?.provider ?? "clef-local";

  useEffect(() => {
    let active = true;
    void fetch("/provider-routing/decision-models/status")
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as SystemOneConfig;
      })
      .then((value) => {
        if (active) setConfig(value);
      })
      .catch(() => {
        if (active) setMessage(mDyn("ai_models_systemone_load_failed"));
      });
    return () => {
      active = false;
    };
  }, []);

  async function save(changes: Record<string, unknown>) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/provider-routing/decision-models/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const updated = (await response.json()) as SystemOneConfig;
      setConfig(updated);
      setSecret("");
      setMessage(mDyn("ai_models_configuration_saved"));
    } catch {
      setMessage(mDyn("ai_models_configuration_save_failed"));
    } finally {
      setSaving(false);
    }
  }

  if (!config)
    return (
      <section
        className="rounded-lg border p-3 text-xs text-muted-foreground"
        aria-label={mDyn("ai_models_systemone_configuration")}
      >
        {message || mDyn("ai_models_systemone_loading")}
      </section>
    );

  const baseUrlKey =
    selected === "clef-local"
      ? "local_base_url"
      : selected === "laya-local"
        ? "laya_base_url"
        : selected === "clef-api"
          ? "clef_api_base_url"
          : "jev_api_base_url";
  const modelKey =
    selected === "clef-local"
      ? "local_model"
      : selected === "laya-local"
        ? "laya_model"
        : selected === "clef-api"
          ? "clef_api_model"
          : "jev_api_model";
  const credentialConfigured =
    selected === "laya-local"
      ? config.laya_api_key_configured
      : selected === "clef-api"
        ? config.clef_api_key_configured
        : selected === "jev-api"
          ? config.jev_api_key_configured
          : false;
  const credentialKey =
    selected === "laya-local"
      ? "laya_api_key"
      : selected === "clef-api"
        ? "clef_api_key"
        : selected === "jev-api"
          ? "jev_api_key"
          : null;
  const accountKey = selected === "clef-api" ? "clef_account_id" : null;
  const accountValue = selected === "clef-api" ? config.clef_account_id : "";
  const baseUrl = config[baseUrlKey as keyof SystemOneConfig] as string;
  const model = config[modelKey as keyof SystemOneConfig] as string;

  return (
    <section
      className="space-y-3 rounded-lg border p-3"
      aria-label={mDyn("ai_models_systemone_provider_configuration")}
    >
      <div>
        <h4 className="text-sm font-medium">
          {mDyn("ai_models_systemone_runtime_credentials")}
        </h4>
        <p className="text-xs text-muted-foreground">
          {mDyn("ai_models_systemone_config_description")}
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(event) => void save({ enabled: event.target.checked })}
        />
        {mDyn("ai_models_systemone_enable_runtime")}
      </label>
      <label className="grid gap-1 text-xs">
        {mDyn("ai_models_systemone_default_provider")}
        <div className="flex items-center gap-2">
          <ProviderIcon
            provider={config.provider}
            className="size-4 shrink-0 text-muted-foreground"
          />
          <select
            className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
            value={config.provider}
            onChange={(event) => void save({ provider: event.target.value })}
          >
            {DECISION_PROVIDERS.map((item) => (
              <option key={item.id} value={item.id}>
                {mDyn(item.label)}
              </option>
            ))}
          </select>
        </div>
      </label>
      <label className="grid gap-1 text-xs">
        {mDyn("ai_models_base_url")}
        <input
          className="h-8 rounded-md border bg-background px-2 text-sm"
          value={baseUrl}
          onChange={(event) =>
            setConfig({ ...config, [baseUrlKey]: event.target.value })
          }
        />
      </label>
      <label className="grid gap-1 text-xs">
        {mDyn("ai_models_model")}
        <input
          className="h-8 rounded-md border bg-background px-2 text-sm"
          value={model}
          onChange={(event) =>
            setConfig({ ...config, [modelKey]: event.target.value })
          }
        />
      </label>
      {accountKey && (
        <label className="grid gap-1 text-xs">
          {mDyn("ai_models_cloudflare_account_id")}
          <input
            className="h-8 rounded-md border bg-background px-2 text-sm"
            value={accountValue}
            onChange={(event) =>
              setConfig({ ...config, clef_account_id: event.target.value })
            }
          />
        </label>
      )}
      {credentialKey && (
        <label className="grid gap-1 text-xs">
          {mDyn("ai_models_credential")}{" "}
          {credentialConfigured ? mDyn("ai_models_credential_keep_hint") : ""}
          <input
            className="h-8 rounded-md border bg-background px-2 text-sm"
            type="password"
            autoComplete="new-password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
          />
        </label>
      )}
      <label className="grid gap-1 text-xs">
        {mDyn("ai_models_minimum_autonomous_confidence")}{" "}
        {config.confidence_threshold_hitl.toFixed(2)}
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={config.confidence_threshold_hitl}
          onChange={(event) =>
            setConfig({
              ...config,
              confidence_threshold_hitl: Number(event.target.value),
            })
          }
        />
      </label>
      <label className="grid gap-1 text-xs">
        {mDyn("ai_models_risk_assessment_timeout")}{" "}
        {config.risk_assessment_timeout_s}
        <input
          type="number"
          min="0.1"
          max="120"
          step="0.1"
          value={config.risk_assessment_timeout_s}
          onChange={(event) =>
            setConfig({
              ...config,
              risk_assessment_timeout_s: Number(event.target.value),
            })
          }
        />
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={config.allow_remote_fallback}
          onChange={(event) =>
            setConfig({
              ...config,
              allow_remote_fallback: event.target.checked,
            })
          }
        />
        {mDyn("ai_models_allow_remote_fallback")}
      </label>
      <button
        type="button"
        className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-50"
        disabled={
          saving ||
          !Number.isFinite(config.risk_assessment_timeout_s) ||
          config.risk_assessment_timeout_s < 0.1 ||
          config.risk_assessment_timeout_s > 120
        }
        onClick={() =>
          void save({
            [baseUrlKey]: baseUrl,
            [modelKey]: model,
            ...(accountKey ? { [accountKey]: accountValue } : {}),
            ...(credentialKey && secret ? { [credentialKey]: secret } : {}),
            confidence_threshold_hitl: config.confidence_threshold_hitl,
            risk_assessment_timeout_s: config.risk_assessment_timeout_s,
            allow_remote_fallback: config.allow_remote_fallback,
          })
        }
      >
        {mDyn("ai_models_save_provider_configuration")}
      </button>
      {message && (
        <p role="status" className="text-xs text-muted-foreground">
          {message}
        </p>
      )}
    </section>
  );
}

function DecisionModelsSection() {
  const workspaceId = useWorkspacesStore((state) => state.active_id);
  const enabled = useSettingsStore((state) => state.decisionModelsEnabled);
  const provider = useSettingsStore((state) => state.decisionModelProvider);
  const surfaces = useSettingsStore((state) => state.decisionModelSurfaces);
  const setEnabled = useSettingsStore(
    (state) => state.setDecisionModelsEnabled,
  );
  const setProvider = useSettingsStore(
    (state) => state.setDecisionModelProvider,
  );
  const setSurfaces = useSettingsStore(
    (state) => state.setDecisionModelSurfaces,
  );
  const [status, setStatus] = useState<DecisionStatus | null>(null);
  const [statusError, setStatusError] = useState(false);

  useEffect(() => {
    void hydrateDecisionModelPreferences(workspaceId);
  }, [workspaceId]);

  useEffect(() => {
    let active = true;
    void fetch(
      `/provider-routing/decision-models/readiness?provider=${encodeURIComponent(provider)}`,
    )
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as DecisionStatus;
      })
      .then((value) => {
        if (active) setStatus(value);
      })
      .catch(() => {
        if (active) setStatusError(true);
      });
    return () => {
      active = false;
    };
  }, [provider]);

  const activeProvider = DECISION_PROVIDERS.find(
    (item) => item.id === provider,
  );
  const readiness = !enabled
    ? m.decision_models_readiness_no_guardrail()
    : statusError
      ? m.decision_models_readiness_unavailable()
      : status?.ready
        ? m.decision_models_readiness_ready()
        : status?.configured
          ? m.decision_models_readiness_unhealthy()
          : m.decision_models_readiness_unconfigured();

  return (
    <section
      className="space-y-3 rounded-lg border bg-[#1f1f1f] p-3"
      aria-label={mDyn("ai_models_decision_models")}
    >
      <div>
        <h4 className="text-sm font-medium">
          {mDyn("ai_models_decision_models")}
        </h4>
        <p className="text-xs text-muted-foreground">
          {mDyn("ai_models_decision_models_description")}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          {mDyn("ai_models_decision_models")}:{" "}
          {enabled ? mDyn("ai_models_enabled") : mDyn("ai_models_disabled")}
        </span>
        <Button
          type="button"
          variant="outline"
          onClick={() => setEnabled(!enabled)}
        >
          {enabled
            ? mDyn("ai_models_disable_decision_models")
            : mDyn("ai_models_enable_decision_models")}
        </Button>
      </div>
      <div className="flex items-center justify-between rounded-lg border bg-[#1a1a1a] px-3 py-2">
        <span className="flex min-w-0 items-center gap-2 truncate text-sm">
          <ProviderIcon provider={provider} className="size-4 shrink-0" />
          {status?.model ||
            (activeProvider ? mDyn(activeProvider.label) : provider)}
        </span>
        <span className="text-sm font-medium">
          {m.provider_routing_already_registered()}
        </span>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {DECISION_PROVIDERS.filter((item) => item.id !== provider).map(
          (item) => (
            <div
              key={item.id}
              className="flex min-w-0 items-center justify-between gap-2 rounded-lg border bg-[#1a1a1a] px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2 truncate text-sm">
                <ProviderIcon provider={item.id} className="size-4 shrink-0" />
                {mDyn(item.label)}
              </span>
              <Button
                type="button"
                size="sm"
                onClick={() => setProvider(item.id)}
              >
                {m.provider_routing_register()}
              </Button>
            </div>
          ),
        )}
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        {readiness}
      </p>
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium">
          {mDyn("ai_models_allowed_surfaces")}
        </legend>
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {DECISION_SURFACES.map(([id, label]) => (
            <label key={id} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={surfaces[id] === true}
                onChange={(event) =>
                  setSurfaces({ ...surfaces, [id]: event.target.checked })
                }
              />
              {mDyn(label)}
            </label>
          ))}
        </div>
      </fieldset>
      <SystemOneConfiguration />
    </section>
  );
}

export function TranscriptionSettings() {
  const selectedModel = useSettingsStore((state) => state.selectedModel);
  const transcriptionMode = useSettingsStore(
    (state) => state.transcriptionMode,
  );
  const setTranscriptionMode = useSettingsStore(
    (state) => state.setTranscriptionMode,
  );
  const [localReadiness, setLocalReadiness] = useState<{
    dependency_available: boolean;
    model_cached: boolean;
    runtime_verified?: boolean;
    probe_attempted?: boolean;
    probe_in_progress?: boolean;
    ready: boolean;
  } | null>(null);
  const [probingLocalRuntime, setProbingLocalRuntime] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/vectora.chat.v1.ChatService/TranscriptionReadiness")
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as {
          dependency_available: boolean;
          model_cached: boolean;
          ready: boolean;
        };
      })
      .then((value) => {
        if (active) setLocalReadiness(value);
      })
      .catch(() => {
        if (active) setLocalReadiness(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const probeLocalRuntime = async () => {
    setProbingLocalRuntime(true);
    try {
      const response = await fetch(
        "/vectora.chat.v1.ChatService/TranscriptionReadiness?probe=true",
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setLocalReadiness(
        (await response.json()) as {
          dependency_available: boolean;
          model_cached: boolean;
          runtime_verified?: boolean;
          probe_attempted?: boolean;
          probe_in_progress?: boolean;
          ready: boolean;
        },
      );
    } catch {
      setLocalReadiness(null);
    } finally {
      setProbingLocalRuntime(false);
    }
  };
  return (
    <section
      className="space-y-3 rounded-lg border bg-[#1f1f1f] p-3"
      aria-label={mDyn("ai_models_transcription")}
    >
      <div>
        <h4 className="text-sm font-medium">
          {mDyn("ai_models_audio_transcription")}
        </h4>
        <p className="text-xs text-muted-foreground">
          {mDyn("ai_models_transcription_description")}
        </p>
      </div>
      <div className="flex items-center justify-between rounded-lg border bg-[#1a1a1a] px-3 py-2">
        <span className="flex min-w-0 items-center gap-2 truncate text-sm">
          <ProviderIcon
            provider={
              transcriptionMode === "local"
                ? "whisper-local"
                : providerFromModelId(selectedModel)
            }
            className="size-4 shrink-0"
          />
          {mDyn(
            transcriptionMode === "local"
              ? "ai_models_transcription_local"
              : "ai_models_transcription_remote",
          )}
        </span>
        <span className="text-sm font-medium">
          {m.provider_routing_already_registered()}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {(["remote", "local"] as const)
          .filter((mode) => mode !== transcriptionMode)
          .map((mode) => (
            <div
              key={mode}
              className="flex items-center justify-between gap-2 rounded-lg border bg-[#1a1a1a] px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2 truncate text-sm">
                <ProviderIcon
                  provider={
                    mode === "local"
                      ? "whisper-local"
                      : providerFromModelId(selectedModel)
                  }
                  className="size-4 shrink-0"
                />
                {mDyn(
                  mode === "local"
                    ? "ai_models_transcription_local"
                    : "ai_models_transcription_remote",
                )}
              </span>
              <Button
                type="button"
                size="sm"
                onClick={() => setTranscriptionMode(mode)}
              >
                {m.provider_routing_register()}
              </Button>
            </div>
          ))}
      </div>
      {transcriptionMode === "local" && (
        <p role="status" className="text-xs text-muted-foreground">
          {!localReadiness
            ? mDyn("ai_models_transcription_readiness_unknown")
            : !localReadiness.dependency_available
              ? mDyn("ai_models_transcription_dependency_missing")
              : !localReadiness.model_cached
                ? mDyn("ai_models_transcription_model_download_required")
                : localReadiness.ready
                  ? mDyn("ai_models_transcription_local_ready")
                  : localReadiness.probe_in_progress
                    ? mDyn("ai_models_transcription_probe_in_progress")
                    : localReadiness.probe_attempted
                      ? mDyn("ai_models_transcription_probe_failed")
                      : mDyn("ai_models_transcription_probe_required")}
        </p>
      )}
      {transcriptionMode === "local" && localReadiness?.model_cached && (
        <button
          type="button"
          className="h-8 rounded-md border px-3 text-xs"
          onClick={() => void probeLocalRuntime()}
          disabled={probingLocalRuntime || localReadiness.probe_in_progress}
        >
          {probingLocalRuntime
            ? mDyn("ai_models_transcription_probe_running")
            : mDyn("ai_models_transcription_probe_button")}
        </button>
      )}
    </section>
  );
}

type LocalSpeechSettingsData = {
  model: string;
  language: string;
  system_command: string;
  system_model: string;
  models: { id: string; cached: boolean }[];
  languages: string[];
  engines: {
    embedded: boolean;
    apple_speech: boolean;
    system: boolean;
    system_kind: string;
  };
};

function languageName(code: string): string {
  try {
    const names = new Intl.DisplayNames([navigator.language || "en"], {
      type: "language",
    });
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

async function patchLocalSpeech(
  body: Partial<
    Pick<
      LocalSpeechSettingsData,
      "model" | "language" | "system_command" | "system_model"
    >
  >,
): Promise<{ data?: LocalSpeechSettingsData; error?: string }> {
  const response = await fetch("/admin/transcription", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (typeof payload.detail === "string") detail = payload.detail;
    } catch {
      /* mantém o status HTTP */
    }
    return { error: detail };
  }
  return { data: (await response.json()) as LocalSpeechSettingsData };
}

/**
 * Transcrição local de anexos de áudio e vídeo: modelo e idioma do whisper
 * embutido, whisper do sistema e os motores detectados nesta máquina
 * (`backend/services/speech_to_text.py`).
 */
export function LocalSpeechSettings() {
  const [data, setData] = useState<LocalSpeechSettingsData | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [systemCommand, setSystemCommand] = useState("");
  const [systemModel, setSystemModel] = useState("");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorText, setErrorText] = useState("");

  const apply = useCallback((value: LocalSpeechSettingsData) => {
    setData(value);
    setSystemCommand(value.system_command ?? "");
    setSystemModel(value.system_model ?? "");
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/admin/transcription")
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const value = (await response.json()) as LocalSpeechSettingsData;
        if (!Array.isArray(value.models)) throw new Error("formato inesperado");
        return value;
      })
      .then((value) => {
        if (active) apply(value);
      })
      .catch(() => {
        if (active) setUnavailable(true);
      });
    return () => {
      active = false;
    };
  }, [apply]);

  const save = async (
    body: Parameters<typeof patchLocalSpeech>[0],
  ): Promise<void> => {
    const result = await patchLocalSpeech(body);
    if (result.data) {
      apply(result.data);
      setStatus("saved");
      setErrorText("");
    } else {
      setStatus("error");
      setErrorText(result.error ?? "");
    }
  };

  if (unavailable) {
    return (
      <section
        className="space-y-2 rounded-lg border p-3"
        aria-label={mDyn("ai_models_stt_title")}
      >
        <h4 className="text-sm font-medium">{mDyn("ai_models_stt_title")}</h4>
        <p role="status" className="text-xs text-muted-foreground">
          {mDyn("ai_models_stt_unavailable")}
        </p>
      </section>
    );
  }
  if (!data) return null;

  const engines: { key: string; label: string; available: boolean }[] = [
    {
      key: "embedded",
      label: mDyn("ai_models_stt_engine_embedded"),
      available: data.engines.embedded,
    },
    ...(data.engines.apple_speech
      ? [
          {
            key: "apple",
            label: mDyn("ai_models_stt_engine_apple"),
            available: true,
          },
        ]
      : []),
    {
      key: "system",
      label: data.engines.system_kind
        ? `${mDyn("ai_models_stt_engine_system")} (${data.engines.system_kind})`
        : mDyn("ai_models_stt_engine_system"),
      available: data.engines.system,
    },
  ];

  return (
    <section
      className="space-y-3 rounded-lg border p-3"
      aria-label={mDyn("ai_models_stt_title")}
    >
      <div>
        <h4 className="text-sm font-medium">{mDyn("ai_models_stt_title")}</h4>
        <p className="text-xs text-muted-foreground">
          {mDyn("ai_models_stt_description")}
        </p>
      </div>
      <ul
        className="space-y-1 text-xs"
        aria-label={mDyn("ai_models_stt_engines")}
      >
        {engines.map((engine) => (
          <li key={engine.key} data-testid={`stt-engine-${engine.key}`}>
            {engine.label}:{" "}
            {engine.available
              ? mDyn("ai_models_stt_engine_available")
              : mDyn("ai_models_stt_engine_missing")}
          </li>
        ))}
      </ul>
      <label className="grid gap-1 text-xs text-muted-foreground">
        {mDyn("ai_models_stt_model_label")}
        <select
          aria-label={mDyn("ai_models_stt_model_label")}
          className="h-9 rounded-md border bg-background px-2 text-sm text-foreground"
          value={data.model}
          onChange={(event) => void save({ model: event.target.value })}
        >
          {data.models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.id} —{" "}
              {model.cached
                ? mDyn("ai_models_stt_model_cached")
                : mDyn("ai_models_stt_model_download")}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        {mDyn("ai_models_stt_language_label")}
        <select
          aria-label={mDyn("ai_models_stt_language_label")}
          className="h-9 rounded-md border bg-background px-2 text-sm text-foreground"
          value={data.language}
          onChange={(event) => void save({ language: event.target.value })}
        >
          <option value="">{mDyn("ai_models_stt_language_auto")}</option>
          {data.languages.map((code) => (
            <option key={code} value={code}>
              {languageName(code)} ({code})
            </option>
          ))}
        </select>
      </label>
      <details className="space-y-2 text-xs">
        <summary className="cursor-pointer text-muted-foreground">
          {mDyn("ai_models_stt_advanced")}
        </summary>
        <label className="grid gap-1 text-muted-foreground">
          {mDyn("ai_models_stt_system_command")}
          <input
            aria-label={mDyn("ai_models_stt_system_command")}
            className="h-8 rounded-md border bg-background px-2 text-sm text-foreground"
            placeholder={mDyn("ai_models_stt_system_command_placeholder")}
            value={systemCommand}
            onChange={(event) => setSystemCommand(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-muted-foreground">
          {mDyn("ai_models_stt_system_model")}
          <input
            aria-label={mDyn("ai_models_stt_system_model")}
            className="h-8 rounded-md border bg-background px-2 text-sm text-foreground"
            placeholder={mDyn("ai_models_stt_system_model_placeholder")}
            value={systemModel}
            onChange={(event) => setSystemModel(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="h-8 rounded-md border px-3 text-xs"
          onClick={() =>
            void save({
              system_command: systemCommand,
              system_model: systemModel,
            })
          }
        >
          {mDyn("ai_models_stt_save")}
        </button>
      </details>
      {status === "saved" && (
        <p role="status" className="text-xs text-muted-foreground">
          {mDyn("ai_models_stt_saved")}
        </p>
      )}
      {status === "error" && (
        <p role="alert" className="text-xs text-destructive">
          {mDyn("ai_models_stt_error")} {errorText}
        </p>
      )}
    </section>
  );
}

export function ChatModelSettings() {
  const selected = useSettingsStore((state) => state.selectedModel);
  const setSelected = useSettingsStore((state) => state.setSelectedModel);
  const [dynamicModels, setDynamicModels] = useState<
    Array<{ id: string; available?: boolean; provider?: string }>
  >([]);
  const [configuredProviders, setConfiguredProviders] = useState<
    string[] | null
  >(null);
  useEffect(() => {
    let alive = true;
    void fetch("/models/providers")
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (
          data: {
            providers?: string[];
            dynamic_models?: Array<{
              id: string;
              available?: boolean;
              provider?: string;
            }>;
          } | null,
        ) => {
          if (alive) {
            setConfiguredProviders(
              Array.isArray(data?.providers) ? data.providers : null,
            );
            setDynamicModels(data?.dynamic_models ?? []);
          }
        },
      )
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const allowedModels = getAllowedModels().filter(
    (model) =>
      model === selected ||
      !configuredProviders ||
      configuredProviders.length === 0 ||
      configuredProviders.includes(getModelProvider(model)),
  );
  const models = [
    ...new Set([
      ...allowedModels,
      ...dynamicModels
        .filter((model) => model.available !== false || model.id === selected)
        .map((model) => model.id),
      selected,
    ]),
  ];
  const registerable = models.filter((model) => model !== selected);
  const providerFor = (modelId: string) =>
    dynamicModels.find((model) => model.id === modelId)?.provider ??
    providerFromModelId(modelId);
  return (
    <section
      className="space-y-3 rounded-lg border bg-[#1f1f1f] p-3"
      aria-label={mDyn("ai_models_chat_primary")}
    >
      <div>
        <h4 className="text-sm font-medium">
          {mDyn("ai_models_chat_primary")}
        </h4>
        <p className="text-xs text-muted-foreground">
          {mDyn("ai_models_chat_primary_help")}
        </p>
      </div>
      <div className="flex items-center justify-between rounded-lg border bg-[#1a1a1a] px-3 py-2">
        <span className="flex min-w-0 items-center gap-2 truncate text-sm">
          <ProviderIcon
            provider={providerFor(selected)}
            className="size-4 shrink-0"
          />
          {getModelDisplayName(selected)}
        </span>
        <span className="text-sm font-medium">
          {m.provider_routing_already_registered()}
        </span>
      </div>
      <div
        className={`grid gap-2 md:grid-cols-2 xl:grid-cols-3 ${registerable.length > 6 ? "max-h-[26rem] overflow-y-auto pr-1" : ""}`}
      >
        {registerable.map((model) => (
          <div
            key={model}
            className="flex min-w-0 items-center justify-between gap-2 rounded-lg border bg-[#1a1a1a] px-3 py-2"
          >
            <span className="flex min-w-0 items-center gap-2 truncate text-sm">
              <ProviderIcon
                provider={providerFor(model)}
                className="size-4 shrink-0"
              />
              {getModelDisplayName(model)}
            </span>
            <Button type="button" size="sm" onClick={() => setSelected(model)}>
              {m.provider_routing_register()}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AiModelsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-foreground">
          {m.settings_category_ai_models()}
        </h3>
        <p className="pt-1 text-xs leading-5 text-muted-foreground">
          {m.ai_models_description()}
        </p>
      </div>
      <ChatModelSettings />
      <DecisionModelsSection />
      <section
        className="space-y-3 rounded-lg border bg-[#1f1f1f] p-3"
        aria-label={mDyn("ai_models_vision_input")}
      >
        <h4 className="text-sm font-medium">
          {mDyn("ai_models_vision_input")}
        </h4>
        <ImageFallbackModelSection />
      </section>
      <RetrievalModelSettings />
      <section className="space-y-3 rounded-lg border bg-[#1f1f1f] p-3">
        <TranscriptionSettings />
        <LocalSpeechSettings />
      </section>
    </div>
  );
}
