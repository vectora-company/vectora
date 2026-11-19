"use client";

/**
 * PreferenciasTab — preferências do usuário no Settings Dialog.
 *
 * - Tema: seletor unificado (sistema / claro / escuro / presets / customizada)
 * - Idioma: en / es / pt (settings-store + i18n)
 * - System prompt personalizado + blocos de treinamento
 */

import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  useSettingsStore,
  MONACO_FONT_SIZE_MIN,
  MONACO_FONT_SIZE_MAX,
  SUPPORTED_LANGS,
  UI_SCALE_PRESETS,
  type Theme,
  type Lang,
  type SidebarPosition,
} from "@/lib/stores/settings-store";
import {
  THEME_PRESETS,
  DEFAULT_CUSTOM_COLORS,
  type BaseThemeColors,
  type ThemePresetDef,
} from "@/lib/theme/presets";
import { ThemePicker } from "@/components/settings/preferencias/theme-picker";
import { useIsDark } from "@/lib/hooks/use-is-dark";
import { getPairedPresetId } from "@/lib/theme/presets";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { m } from "@/lib/paraglide/messages";
import {
  SettingsMessage,
  SettingsSection,
  SettingsStack,
} from "@/components/settings/primitives";
import { useServicesDisabled } from "@/components/layout/services-off-notice";
import { mDyn } from "@/lib/i18n-dyn";

/** Rótulo do tema selecionado, resolvido explicitamente (não deixado pro
 * registro interno do Radix Select) — sem isso o trigger mostra vazio no
 * primeiro paint, antes do `SelectItem` correspondente montar. */
export function themeLabel(id: string): string {
  if (id === "system") return m.prefs_theme_system();
  if (id === "custom") return m.prefs_theme_palette_custom();
  return THEME_PRESETS.find((preset) => preset.id === id)?.label ?? id;
}

const CUSTOM_COLOR_FIELDS: { key: keyof BaseThemeColors; labelKey: string }[] =
  [
    { key: "background", labelKey: "prefs.custom_color.background" },
    { key: "foreground", labelKey: "prefs.custom_color.foreground" },
    { key: "card", labelKey: "prefs.custom_color.card" },
    { key: "border", labelKey: "prefs.custom_color.border" },
    { key: "primary", labelKey: "prefs.custom_color.primary" },
    { key: "accent", labelKey: "prefs.custom_color.accent" },
    { key: "muted", labelKey: "prefs.custom_color.muted" },
    { key: "sidebar", labelKey: "prefs.custom_color.sidebar" },
    { key: "userBubble", labelKey: "prefs.custom_color.user_bubble" },
  ];

const FONT_OPTIONS = [
  {
    value: '"JetBrains Mono", ui-monospace, monospace',
    label: "JetBrains Mono",
  },
  {
    value: '"Source Code Pro", ui-monospace, monospace',
    label: "Source Code Pro",
  },
  { value: '"Cascadia Code", ui-monospace, monospace', label: "Cascadia Code" },
  { value: "Inter, ui-sans-serif, system-ui, sans-serif", label: "Inter" },
  { value: '"Segoe UI", ui-sans-serif, sans-serif', label: "Segoe UI" },
  { value: "system-ui, sans-serif", label: "System UI" },
] as const;

function FontSelect({
  id,
  label,
  help,
  value,
  onChange,
  mono = false,
}: {
  id: string;
  label: string;
  help: string;
  value: string;
  onChange: (value: string) => void;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground">{help}</p>
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          id={id}
          className="w-[210px] shrink-0"
          style={{ fontFamily: mono ? value : undefined }}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FONT_OPTIONS.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              style={{ fontFamily: option.value }}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Liga ou desliga a compactação automática do histórico (vai em cada envio). */
function ContextCompactionSection() {
  const enabled = useSettingsStore((s) => s.contextCompactionEnabled);
  const setEnabled = useSettingsStore((s) => s.setContextCompactionEnabled);
  return (
    <SettingsSection title={m.prefs_context_compaction_section()}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor="context-compaction-toggle" className="cursor-pointer">
            {m.prefs_context_compaction_toggle()}
          </Label>
          <p className="text-xs text-muted-foreground">
            {m.prefs_context_compaction_hint()}
          </p>
        </div>
        <Switch
          id="context-compaction-toggle"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </div>
    </SettingsSection>
  );
}

/** Toggle de auto-update (Electron) + botão de checagem manual — a checagem
 * manual funciona independente do toggle (dispara `checkForUpdates()` sob
 * demanda mesmo com o automático desligado). Invisível no navegador/modo
 * servidor: `window.vectora` só existe dentro do app desktop. */
export function AutoUpdateSection({
  autoUpdateEnabled,
  setAutoUpdateEnabled,
}: {
  autoUpdateEnabled: boolean;
  setAutoUpdateEnabled: (v: boolean) => void;
}) {
  // Só existe no app desktop; no navegador não há atualização a consultar.
  if (typeof window === "undefined" || !window.vectora) return null;
  return (
    <AutoUpdateControls
      autoUpdateEnabled={autoUpdateEnabled}
      setAutoUpdateEnabled={setAutoUpdateEnabled}
    />
  );
}

function AutoUpdateControls({
  autoUpdateEnabled,
  setAutoUpdateEnabled,
}: {
  autoUpdateEnabled: boolean;
  setAutoUpdateEnabled: (v: boolean) => void;
}) {
  const [checking, setChecking] = useState(false);
  const servicesOff = useServicesDisabled();

  const handleCheckNow = () => {
    setChecking(true);
    window.vectora?.checkForUpdate?.();
    setTimeout(() => setChecking(false), 3000);
  };

  return (
    <SettingsSection title={m.prefs_auto_update_section()}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor="auto-update-toggle" className="cursor-pointer">
            {m.prefs_auto_update_toggle()}
          </Label>
          <p className="text-xs text-muted-foreground">
            {m.prefs_auto_update_toggle_hint()}
          </p>
        </div>
        <Switch
          id="auto-update-toggle"
          checked={autoUpdateEnabled}
          onCheckedChange={setAutoUpdateEnabled}
          disabled={servicesOff}
        />
      </div>
      {servicesOff && (
        <SettingsMessage tone="info" data-testid="auto-update-services-off">
          {m.prefs_auto_update_services_off()}
        </SettingsMessage>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleCheckNow}
        disabled={checking || servicesOff}
      >
        {checking
          ? m.prefs_auto_update_checking()
          : m.prefs_auto_update_check_now()}
      </Button>
    </SettingsSection>
  );
}

/** Fuso horário do usuário — o scheduler já usava `user_timezone` para
 * converter "toda segunda às 9h" no UTC de armazenamento; sem este seletor a
 * config só existia por API e "9h" virava 9h UTC pra todo mundo. */
function TimezoneSection() {
  const [timezone, setTimezone] = useState("");
  const [available, setAvailable] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/admin/timezone");
        if (!res.ok || !alive) return;
        const data = (await res.json()) as {
          timezone?: string;
          available?: string[];
        };
        if (!alive) return;
        setTimezone(data.timezone ?? "");
        setAvailable(Array.isArray(data.available) ? data.available : []);
      } catch {
        if (alive) setAvailable([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function handleChange(next: string) {
    setError("");
    const previous = timezone;
    setTimezone(next);
    try {
      const res = await fetch("/admin/timezone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      // Reverte a seleção: deixar o valor novo na tela sugeriria que salvou.
      setTimezone(previous);
      setError(m.prefs_timezone_error());
    }
  }

  if (available.length === 0) return null;

  return (
    <SettingsSection
      title={m.prefs_timezone_section()}
      description={m.prefs_timezone_hint()}
    >
      <Select value={timezone} onValueChange={(v) => void handleChange(v)}>
        <SelectTrigger
          id="timezone"
          className="w-[280px]"
          aria-label={m.prefs_timezone_section()}
        >
          <SelectValue placeholder={m.prefs_timezone_placeholder()} />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {available.map((tz) => (
            <SelectItem key={tz} value={tz}>
              {tz}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <SettingsMessage tone="danger">{error}</SettingsMessage>}
    </SettingsSection>
  );
}

export function PreferenciasTab() {
  const {
    theme,
    themePreset,
    customThemeColors,
    language,
    customSystemPrompt,
    trainingInstructions,
    setTheme,
    setThemePreset,
    setCustomThemeColors,
    setLanguage,
    sidebarPosition,
    setSidebarPosition,
    showToolCalls,
    setShowToolCalls,
    setCustomSystemPrompt,
    setTrainingInstructions,
    autoUpdateEnabled,
    setAutoUpdateEnabled,
    installedThemes,
    addInstalledTheme,
    uiScalePercent,
    setUiScalePercent,
    editorFontFamily,
    monoFontFamily,
    uiFontFamily,
    setEditorFontFamily,
    setMonoFontFamily,
    setUiFontFamily,
    monacoFontSize,
    setMonacoFontSize,
    editorAutoSave,
    setEditorAutoSave,
  } = useSettingsStore();

  const isDark = useIsDark();
  const activeMode = isDark ? "dark" : "light";

  const marketplaceSupported =
    typeof window !== "undefined" && Boolean(window.vectora?.themes);

  const activeCustomColors = customThemeColors ?? DEFAULT_CUSTOM_COLORS;
  const handleCustomColorChange = (
    key: keyof BaseThemeColors,
    value: string,
  ) => {
    setCustomThemeColors({ ...activeCustomColors, [key]: value });
  };

  // Grid de paletas: "custom" | id de THEME_PRESETS/installedThemes —
  // "default" (sentinela de "sem preset, usa o tema base") não corresponde
  // a nenhum card, então nenhum fica marcado como ativo (comportamento
  // correto: nenhuma paleta específica escolhida ainda). Claro/escuro/
  // sistema é um controle à parte, embutido no cabeçalho da grade.
  const selectedTheme = themePreset === "custom" ? "custom" : themePreset;

  const handleThemeChange = (value: string) => {
    if (value === "custom") {
      setThemePreset("custom");
      return;
    }
    setThemePreset(value);
  };

  /** Selects the paired preset whenever the interface mode changes. */
  const syncPresetToMode = useCallback(
    (targetMode: "light" | "dark") => {
      if (themePreset === "default" || themePreset === "custom") return;
      const paired = getPairedPresetId(themePreset, targetMode);
      if (paired && paired !== themePreset) setThemePreset(paired);
    },
    [setThemePreset, themePreset],
  );

  const handleModeChange = (mode: Theme) => {
    const targetMode =
      mode === "system"
        ? typeof window.matchMedia !== "function"
          ? "dark"
          : window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
        : mode;
    syncPresetToMode(targetMode);
    setTheme(mode);
  };

  useEffect(() => {
    if (theme !== "system") return;
    if (typeof window.matchMedia !== "function") {
      syncPresetToMode("dark");
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    syncPresetToMode(media.matches ? "dark" : "light");
    const handleChange = (event: MediaQueryListEvent) =>
      syncPresetToMode(event.matches ? "dark" : "light");
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [syncPresetToMode, theme]);

  const handleAddTrainingBlock = () => {
    setTrainingInstructions([...trainingInstructions, ""]);
  };

  const handleTrainingBlockChange = (index: number, value: string) => {
    setTrainingInstructions(
      trainingInstructions.map((block, i) => (i === index ? value : block)),
    );
  };

  const handleRemoveTrainingBlock = (index: number) => {
    setTrainingInstructions(trainingInstructions.filter((_, i) => i !== index));
  };

  return (
    <SettingsStack>
      {/* Aparência — tema (com preview) + UI Scale, agrupados numa seção só,
          em vez de espalhados sem relação visual entre si. */}
      <SettingsSection title={m.prefs_appearance_section()}>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label>{m.prefs_theme()}</Label>
            <SegmentedControl
              value={theme}
              onChange={handleModeChange}
              aria-label={m.prefs_theme_mode()}
              options={[
                { id: "system" as Theme, label: m.prefs_theme_system() },
                { id: "light" as Theme, label: m.prefs_theme_light() },
                { id: "dark" as Theme, label: m.prefs_theme_dark() },
              ]}
            />
          </div>
          <ThemePicker
            value={selectedTheme}
            onChange={handleThemeChange}
            activeMode={activeMode}
            presets={THEME_PRESETS}
            installedThemes={installedThemes}
            customLabel={m.prefs_theme_palette_custom()}
            showMoreLabel={m.prefs_theme_palette_show_more()}
            showLessLabel={m.prefs_theme_palette_show_less()}
            customColors={activeCustomColors}
            searchPlaceholder={m.prefs_theme_search_placeholder()}
            marketplaceSupported={marketplaceSupported}
            marketplaceErrorLabel={m.prefs_theme_marketplace_error()}
            marketplaceInstallLabel={m.prefs_theme_marketplace_install()}
            marketplaceInstalledLabel={m.prefs_theme_marketplace_installed()}
            marketplaceLoadingLabel={m.prefs_theme_marketplace_loading()}
            onThemeInstalled={(installed: ThemePresetDef) => {
              addInstalledTheme(installed);
              setThemePreset(installed.id);
            }}
          />
          <p className="text-xs text-muted-foreground">
            {m.prefs_theme_palette_help()}
          </p>

          {themePreset === "custom" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {CUSTOM_COLOR_FIELDS.map(({ key, labelKey }) => (
                <div key={key} className="space-y-1">
                  <Label htmlFor={`custom-color-${key}`} className="text-xs">
                    {mDyn(labelKey)}
                  </Label>
                  <div className="flex items-center gap-2">
                    <input
                      id={`custom-color-${key}`}
                      type="color"
                      value={activeCustomColors[key]}
                      onChange={(e) =>
                        handleCustomColorChange(key, e.target.value)
                      }
                      className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
                    />
                    <span className="text-2xs font-mono text-muted-foreground truncate">
                      {activeCustomColors[key]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <Label>{m.prefs_ui_scale()}</Label>
            <p className="text-xs text-muted-foreground">
              {m.prefs_ui_scale_help()}
            </p>
          </div>
          <SegmentedControl
            value={String(uiScalePercent)}
            onChange={(id) => setUiScalePercent(Number(id))}
            aria-label={m.prefs_ui_scale()}
            options={UI_SCALE_PRESETS.map((preset) => ({
              id: String(preset),
              label: `${preset}%`,
            }))}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title={m.prefs_fonts_section()}
        description={m.prefs_fonts_godot_help()}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Label htmlFor="editor-auto-save">
              {m.prefs_editor_auto_save()}
            </Label>
            <p className="text-xs text-muted-foreground">
              {m.prefs_editor_auto_save_help()}
            </p>
          </div>
          <Switch
            id="editor-auto-save"
            checked={editorAutoSave}
            onCheckedChange={setEditorAutoSave}
          />
        </div>
        <FontSelect
          id="editor-font-family"
          label={m.prefs_editor_font()}
          help={m.prefs_editor_font_help()}
          value={editorFontFamily}
          onChange={setEditorFontFamily}
        />
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Label htmlFor="editor-font-size">
              {m.prefs_editor_font_size()}
            </Label>
            <p className="text-xs text-muted-foreground">
              {m.prefs_editor_font_size_help()}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Input
              id="editor-font-size"
              type="number"
              min={MONACO_FONT_SIZE_MIN}
              max={MONACO_FONT_SIZE_MAX}
              step={1}
              value={monacoFontSize}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) setMonacoFontSize(value);
              }}
              className="w-[100px]"
              aria-label={m.prefs_editor_font_size()}
            />
            <span className="text-xs text-muted-foreground">
              {m.prefs_editor_font_size_unit()}
            </span>
          </div>
        </div>
        <FontSelect
          id="mono-font-family"
          label={m.prefs_mono_font()}
          help={m.prefs_mono_font_help()}
          value={monoFontFamily}
          onChange={setMonoFontFamily}
          mono
        />
        <FontSelect
          id="ui-font-family"
          label={m.prefs_ui_font()}
          help={m.prefs_ui_font_help()}
          value={uiFontFamily}
          onChange={setUiFontFamily}
        />
      </SettingsSection>

      <SettingsSection title={m.prefs_interface_section()}>
        {/* Idioma */}
        <div className="space-y-2">
          <Label htmlFor="language">{m.prefs_language()}</Label>
          <Select
            value={language}
            onValueChange={(v) => setLanguage(v as Lang)}
          >
            <SelectTrigger id="language">
              <SelectValue>
                {SUPPORTED_LANGS.find((l) => l.value === language)?.label ??
                  language}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Posição da sidebar de sessões (workbench no lado oposto) */}
        <div className="space-y-2">
          <Label htmlFor="sidebar-position">{m.prefs_sidebar_position()}</Label>
          <Select
            value={sidebarPosition}
            onValueChange={(v) => setSidebarPosition(v as SidebarPosition)}
          >
            <SelectTrigger id="sidebar-position">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">
                {m.prefs_sidebar_position_left()}
              </SelectItem>
              <SelectItem value="right">
                {m.prefs_sidebar_position_right()}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Exibe as chamadas de tool na interface do chat. */}
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="show-tool-calls" className="cursor-pointer">
            {m.settings_chat_show_tool_calls()}
          </Label>
          <Switch
            id="show-tool-calls"
            checked={showToolCalls}
            onCheckedChange={setShowToolCalls}
          />
        </div>
      </SettingsSection>

      {/* System prompt personalizado */}
      <SettingsSection
        title={m.prefs_custom_prompt()}
        description={m.prefs_custom_prompt_help()}
      >
        <Label htmlFor="custom-prompt" className="sr-only">
          {m.prefs_custom_prompt()}
        </Label>
        <Textarea
          id="custom-prompt"
          placeholder={m.prefs_custom_prompt_placeholder()}
          value={customSystemPrompt}
          onChange={(e) => setCustomSystemPrompt(e.target.value)}
          rows={4}
          className="resize-none text-sm"
        />
      </SettingsSection>

      {/* Treinamento — blocos de instrução adicionais */}
      <SettingsSection
        title={m.prefs_training()}
        description={m.prefs_training_help()}
        actions={
          <Button variant="ghost" size="sm" onClick={handleAddTrainingBlock}>
            <Plus className="size-3.5" />
            {m.prefs_training_add()}
          </Button>
        }
      >
        {trainingInstructions.map((block, index) => (
          <div key={index} className="flex items-start gap-2">
            <Textarea
              placeholder={m.prefs_training_placeholder()}
              value={block}
              onChange={(e) => handleTrainingBlockChange(index, e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive shrink-0"
              onClick={() => handleRemoveTrainingBlock(index)}
              title={m.prefs_training_remove()}
              aria-label={m.prefs_training_remove()}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </SettingsSection>

      {/* Compactação automática do histórico */}
      <ContextCompactionSection />

      {/* Auto-update (só desktop) */}
      <AutoUpdateSection
        autoUpdateEnabled={autoUpdateEnabled}
        setAutoUpdateEnabled={setAutoUpdateEnabled}
      />

      {/* Fuso horário usado pelos agendamentos */}
      <TimezoneSection />
    </SettingsStack>
  );
}
