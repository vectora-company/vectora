"use client";

import { useCallback, useEffect, useState } from "react";
import { mDyn } from "@/lib/i18n-dyn";

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
      <section
        className="space-y-2 rounded-lg border p-3"
        aria-label={mDyn("media_limits_title")}
      >
        <h4 className="text-sm font-medium">{mDyn("media_limits_title")}</h4>
        <p className="text-xs text-muted-foreground">
          {mDyn("media_limits_unavailable")}
        </p>
      </section>
    );
  }
  if (!data) return null;

  return (
    <section
      className="space-y-3 rounded-lg border p-3"
      aria-label={mDyn("media_limits_title")}
    >
      <div>
        <h4 className="text-sm font-medium">{mDyn("media_limits_title")}</h4>
        <p className="text-xs text-muted-foreground">
          {mDyn("media_limits_description")}
        </p>
      </div>
      {MEDIA_LIMIT_FIELDS.map(([name, labelKey]) => {
        const limit = data[name];
        return (
          <label
            key={name}
            className="grid gap-1 text-xs text-muted-foreground"
          >
            {mDyn(labelKey)}
            <input
              type="number"
              inputMode="numeric"
              aria-label={mDyn(labelKey)}
              className="h-9 rounded-md border bg-background px-2 text-sm text-foreground"
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
            <span>
              {mDyn("media_limits_range")} {limit.min}–{limit.max},{" "}
              {mDyn("media_limits_default")} {limit.default}
            </span>
          </label>
        );
      })}
      <button
        type="button"
        className="h-8 rounded-md border px-3 text-xs"
        onClick={() => void save()}
      >
        {mDyn("media_limits_save")}
      </button>
      {status === "saved" && (
        <p role="status" className="text-xs text-muted-foreground">
          {mDyn("media_limits_saved")}
        </p>
      )}
      {status === "error" && (
        <p role="alert" className="text-xs text-destructive">
          {mDyn("media_limits_error")} {errorText}
        </p>
      )}
    </section>
  );
}

export function MediaSettingsTab() {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-foreground">
        {mDyn("settings_category_media")}
      </h3>
      <MediaLimitsSettings />
    </div>
  );
}
