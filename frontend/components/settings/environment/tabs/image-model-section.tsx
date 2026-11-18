"use client";

/** Seleção explícita de modelo para entrada com imagem. */

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAllowedModels,
  getModelDisplayName,
  getModelProvider,
  isProviderVisionCapable,
  isModelImageCapable,
  type ProviderModelInfo,
  type ModelOption,
} from "@/lib/config/deployment-config";
import { ProviderIcon } from "@/components/icons/provider-icons";
import { m } from "@/lib/paraglide/messages";

const IMAGE_FALLBACK_NONE = "__none__";

async function fetchImageFallbackModel(): Promise<string> {
  const res = await fetch("/admin/model/image-fallback");
  if (!res.ok) return "";
  const data = (await res.json()) as { model: string };
  return data.model ?? "";
}

async function saveImageFallbackModel(model: string): Promise<void> {
  await fetch("/admin/model/image-fallback", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: model === IMAGE_FALLBACK_NONE ? "" : model }),
  });
}

export function ImageFallbackModelSection() {
  const [model, setModel] = useState<string>(IMAGE_FALLBACK_NONE);
  const [models, setModels] = useState<ProviderModelInfo[]>([]);

  useEffect(() => {
    fetchImageFallbackModel()
      .then((fetched) => setModel(fetched || IMAGE_FALLBACK_NONE))
      .catch(() => setModel(IMAGE_FALLBACK_NONE));
  }, []);

  useEffect(() => {
    fetch("/models/providers")
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("catalog")),
      )
      .then(
        (data: {
          models?: ProviderModelInfo[];
          dynamic_models?: ProviderModelInfo[];
        }) =>
          setModels([...(data.models ?? []), ...(data.dynamic_models ?? [])]),
      )
      .catch(() => setModels([]));
  }, []);

  const onChange = (value: string) => {
    setModel(value);
    void saveImageFallbackModel(value);
  };

  return (
    <div className="space-y-2">
      <Label>{m.prefs_image_fallback_title()}</Label>
      <p className="text-xs text-muted-foreground">
        {m.prefs_image_fallback_help()}
      </p>
      <Select value={model} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={IMAGE_FALLBACK_NONE} className="text-xs">
            {m.prefs_image_fallback_none()}
          </SelectItem>
          {(models.length > 0
            ? models.filter(isModelImageCapable).map((item) => item.id)
            : getAllowedModels().filter((mid) =>
                isProviderVisionCapable(getModelProvider(mid)),
              )
          ).map((mid) => (
            <SelectItem key={mid} value={mid} className="text-xs">
              {getModelDisplayName(mid as ModelOption) || mid}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
