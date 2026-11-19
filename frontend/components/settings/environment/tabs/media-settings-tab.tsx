"use client";

import { useCallback, useEffect, useState } from "react";
import { mDyn } from "@/lib/i18n-dyn";
import { Button } from "@/components/ui/button";
import {
  SettingsMessage,
  SettingsSection,
  SettingsStack,
  SettingsTabHeader,
  settingsInputClass,
  settingsLabelClass,
} from "@/components/settings/primitives";

const MEDIA_LIMIT_FIELDS = [
  ["pdf_pages", "media_limits_pdf_pages"],
  ["video_frames", "media_limits_video_frames"],
  ["max_side", "media_limits_max_side"],
  ["quality", "media_limits_quality"],
  ["max_images", "media_limits_max_images"],
] as const;

type MediaLimitName = (typeof MEDIA_LIMIT_FIELDS)[number][0];

type MediaLimitsData = Record<
  MediaLimitName,
  { value: number; default: number; min: number; max: number }
>;

function isMediaLimitsData(value: unknown): value is MediaLimitsData {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return MEDIA_LIMIT_FIELDS.every(([name]) => {
    const item = record[name] as { value?: unknown } | undefined;
    return typeof item?.value === "number";
  });
}

/**
 * Limites das imagens geradas de PDF e vídeo: páginas, quadros, resolução,
 * qualidade e teto de imagens (`backend/services/media_limits.py`).
 */
export function MediaLimitsSettings() {
  const [data, setData] = useState<MediaLimitsData | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorText, setErrorText] = useState("");

  const apply = useCallback((value: MediaLimitsData) => {
    setData(value);
    setDraft(
      Object.fromEntries(
        MEDIA_LIMIT_FIELDS.map(([name]) => [name, String(value[name].value)]),
      ),
    );
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/admin/media-limits")
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const value: unknown = await response.json();
        if (!isMediaLimitsData(value)) throw new Error("formato inesperado");
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

  const save = async (): Promise<void> => {
    if (!data) return;
    const body: Record<string, number> = {};
    for (const [name] of MEDIA_LIMIT_FIELDS) {
      const next = Number(draft[name]);
      if (Number.isFinite(next) && next !== data[name].value) body[name] = next;
    }
    const response = await fetch("/admin/media-limits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) {
      const value: unknown = await response.json();
      if (isMediaLimitsData(value)) apply(value);
      setStatus("saved");
      setErrorText("");
      return;
    }
    let detail = `HTTP ${response.status}`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (typeof payload.detail === "string") detail = payload.detail;
    } catch {
      /* mantém o status HTTP */
    }
    setStatus("error");
    setErrorText(detail);
  };

  if (unavailable) {
    return (
      <SettingsSection
        aria-label={mDyn("media_limits_title")}
        title={mDyn("media_limits_title")}
        description={mDyn("media_limits_unavailable")}
      />
    );
  }
  if (!data) return null;

  return (
    <SettingsSection
      aria-label={mDyn("media_limits_title")}
      title={mDyn("media_limits_title")}
      description={mDyn("media_limits_description")}
    >
      {MEDIA_LIMIT_FIELDS.map(([name, labelKey]) => {
        const limit = data[name];
        return (
          <label key={name} className={settingsLabelClass}>
            {mDyn(labelKey)}
            <input
              type="number"
              inputMode="numeric"
              aria-label={mDyn(labelKey)}
              className={settingsInputClass}
              min={limit.min}
              max={limit.max}
              value={draft[name] ?? ""}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  [name]: event.target.value,
                }))
              }
            />
            <span className="text-muted-foreground">
              {mDyn("media_limits_range")} {limit.min}–{limit.max},{" "}
              {mDyn("media_limits_default")} {limit.default}
            </span>
          </label>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void save()}
      >
        {mDyn("media_limits_save")}
      </Button>
      {status === "saved" && (
        <SettingsMessage tone="success">
          {mDyn("media_limits_saved")}
        </SettingsMessage>
      )}
      {status === "error" && (
        <SettingsMessage tone="danger">
          {mDyn("media_limits_error")} {errorText}
        </SettingsMessage>
      )}
    </SettingsSection>
  );
}

export function MediaSettingsTab() {
  return (
    <SettingsStack>
      <SettingsTabHeader title={mDyn("settings_category_media")} />
      <MediaLimitsSettings />
    </SettingsStack>
  );
}
