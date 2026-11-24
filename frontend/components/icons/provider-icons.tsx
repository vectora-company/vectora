/**
 * Ícones dos provedores de LLM, usados no seletor de modelo e nas configurações.
 * Ollama, llama.cpp, Hugging Face, Laya, Clef, JEV, 9Router e OmniRoute usam o
 * logo em arquivo; os demais seguem como ícones simplificados até haver arquivo de
 * origem (ver `assets/provider-logos/CREDITS.md`).
 */

import clefLogo from "@/assets/provider-logos/clef.png";
import huggingfaceLogo from "@/assets/provider-logos/huggingface.svg";
import jevOnDark from "@/assets/provider-logos/jev-on-dark.png";
import jevOnLight from "@/assets/provider-logos/jev-on-light.png";
import layaLogo from "@/assets/provider-logos/laya.svg";
import llamacppOnDark from "@/assets/provider-logos/llamacpp-on-dark.svg";
import llamacppOnLight from "@/assets/provider-logos/llamacpp-on-light.svg";
import ninerouterLogo from "@/assets/provider-logos/ninerouter.svg";
import ollamaOnDark from "@/assets/provider-logos/ollama-on-dark.svg";
import ollamaOnLight from "@/assets/provider-logos/ollama-on-light.svg";
import omnirouteLogo from "@/assets/provider-logos/omniroute.svg";
import { useIsDark } from "@/lib/hooks/use-is-dark";

/**
 * Logo oficial do provider, carregado do arquivo SVG de origem (ver
 * `assets/provider-logos/CREDITS.md`). Marcas com glifo de uma cor só têm uma
 * variante por tema; as coloridas usam o mesmo arquivo nos dois.
 */
function LogoImage({
  onDark,
  onLight,
  className,
}: {
  onDark: string;
  onLight?: string;
  className?: string;
}) {
  const isDark = useIsDark();
  return (
    <img
      src={isDark ? onDark : (onLight ?? onDark)}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`${className ?? ""} object-contain`}
    />
  );
}

export function OllamaIcon({ className }: { className?: string }) {
  return (
    <LogoImage
      onDark={ollamaOnDark}
      onLight={ollamaOnLight}
      className={className}
    />
  );
}

function LlamaCppIcon({ className }: { className?: string }) {
  return (
    <LogoImage
      onDark={llamacppOnDark}
      onLight={llamacppOnLight}
      className={className}
    />
  );
}

function HuggingFaceIcon({ className }: { className?: string }) {
  return <LogoImage onDark={huggingfaceLogo} className={className} />;
}

export function NineRouterIcon({ className }: { className?: string }) {
  return <LogoImage onDark={ninerouterLogo} className={className} />;
}

function LayaIcon({ className }: { className?: string }) {
  return <LogoImage onDark={layaLogo} className={className} />;
}

export function OmniRouteIcon({ className }: { className?: string }) {
  return <LogoImage onDark={omnirouteLogo} className={className} />;
}

export function GeminiIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 2c0 4.4-1.1 7.4-3.2 9.5C6.7 13.6 4.2 14.7 0 14.7c4.4 0 7.4 1.1 9.5 3.2 2.1 2.1 3.2 5.1 3.2 9.5 0-4.4 1.1-7.4 3.2-9.5 2.1-2.1 5.1-3.2 9.5-3.2-4.4 0-7.4-1.1-9.5-3.2C13.1 9.4 12 6.4 12 2z"
        fill="currentColor"
        transform="translate(1.4 -2.7) scale(0.92)"
      />
    </svg>
  );
}

export function OpenAiIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M22.28 9.82a5.98 5.98 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A6.07 6.07 0 0 0 10.8 0a6.06 6.06 0 0 0-5.78 4.2 5.98 5.98 0 0 0-4 2.9 6.05 6.05 0 0 0 .75 7.1 5.98 5.98 0 0 0 .51 4.92 6.05 6.05 0 0 0 6.52 2.9A6.06 6.06 0 0 0 13.2 24a6.06 6.06 0 0 0 5.78-4.21 5.98 5.98 0 0 0 4-2.9 6.05 6.05 0 0 0-.7-7.07ZM13.2 22.43a4.5 4.5 0 0 1-2.9-1.05l.14-.08 4.81-2.78a.78.78 0 0 0 .4-.69v-6.78l2.03 1.18a.07.07 0 0 1 .04.06v5.61a4.53 4.53 0 0 1-4.52 4.53ZM3.6 18.36a4.5 4.5 0 0 1-.54-3.04l.14.09 4.81 2.78a.78.78 0 0 0 .79 0l5.88-3.39v2.35a.08.08 0 0 1-.03.07l-4.86 2.81a4.53 4.53 0 0 1-6.19-1.67ZM2.34 7.9a4.5 4.5 0 0 1 2.36-1.98v5.71a.77.77 0 0 0 .39.68l5.88 3.39-2.03 1.18a.08.08 0 0 1-.07 0L3.98 14.07A4.53 4.53 0 0 1 2.34 7.9Zm16.73 3.88-5.88-3.4 2.03-1.17a.08.08 0 0 1 .07 0l4.89 2.82a4.52 4.52 0 0 1-.7 8.16v-5.71a.78.78 0 0 0-.41-.7Zm2.02-3.04-.14-.09-4.81-2.79a.79.79 0 0 0-.79 0L9.47 9.25V6.9a.07.07 0 0 1 .03-.07l4.86-2.8a4.52 4.52 0 0 1 6.73 4.7ZM8.36 12.85l-2.03-1.17a.08.08 0 0 1-.04-.06V5.99a4.52 4.52 0 0 1 7.42-3.47l-.14.08-4.81 2.78a.78.78 0 0 0-.4.69v6.78ZM9.47 10.4 12 8.94l2.53 1.46v2.92L12 14.78l-2.53-1.46Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function AnthropicIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M13.83 3.5h3.3L24 20.5h-3.3l-6.87-17ZM6.87 3.5h3.4l6.87 17h-3.36l-1.4-3.6H4.97l-1.4 3.6H.21l6.66-17Zm-.86 10.6h4.46l-2.23-5.78-2.23 5.78Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function CohereIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M9.5 3C5.36 3 2 6.36 2 10.5S5.36 18 9.5 18H14a4.5 4.5 0 0 0 0-9H10a3 3 0 1 0 0 6h3.5a1.5 1.5 0 0 0 0-3H10"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function OpenRouterIcon({ className }: { className?: string }) {
  // Sem ícone de marca oficial simplificado — proxy multi-provider
  // representado como setas convergindo pra um nó central (roteamento).
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      <path
        d="M12 9.5V4M12 14.5V20M9.5 12H4M14.5 12H20M7.6 7.6 4 4M16.4 7.6 20 4M7.6 16.4 4 20M16.4 16.4 20 20"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function VoyageIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M3 5.5 9.4 18h5.2L21 5.5h-4.2L12 14.7 7.2 5.5H3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function MistralIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M3 5h4v4H3V5Zm7 0h4v4h-4V5Zm7 0h4v4h-4V5ZM3 10h4v4H3v-4Zm7 0h4v4h-4v-4Zm7 0h4v4h-4v-4ZM3 15h4v4H3v-4Zm7 0h4v4h-4v-4Zm7 0h4v4h-4v-4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function DeepSeekIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M5 7.5c2.2-2.4 5.2-2.4 7.2 0l1.5 1.8 1.4-1.5c1.2-1.3 3.1-1.4 4.4-.2l1.5 1.4-1.8 1.9-1.5-1.4-2.1 2.3 2.1 2.5c1 1.2.8 3-.4 4-.6.5-1.3.7-2.1.7H7.8C4.6 19 2 16.4 2 13.2c0-2.1 1.1-4.2 3-5.7Zm2 2c-1.1.9-1.7 2.2-1.7 3.7 0 1.8 1.4 3.2 3.2 3.2h6.7l-3-3.6-2 1.8-1.8-2 2-1.8-1.3-1.5c-.6-.7-1.4-.7-2.1.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GroqIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7L12 2.5Zm0 3.1L6.4 8.5v7l5.6 2.9 5.6-2.9v-4.2H12v2.8h2.6v.1L12 15.6l-2.8-1.5v-3.2L12 9.4l1.5.8 2.5-1.4L12 5.6Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ClefIcon({ className }: { className?: string }) {
  return <LogoImage onDark={clefLogo} className={className} />;
}

function JevIcon({ className }: { className?: string }) {
  return (
    <LogoImage onDark={jevOnDark} onLight={jevOnLight} className={className} />
  );
}

export function WhisperIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 3v18M8 7v10m8-10v10M4 10v4m16-4v4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DockerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M3 10h3v3H3v-3Zm4 0h3v3H7v-3Zm4 0h3v3h-3v-3Zm4 0h3v3h-3v-3Zm-8-4h3v3H7V6Zm4 0h3v3h-3V6Zm4 0h3v3h-3V6Zm4 4.5c1.2-.5 2.2-.3 3 .5-.5 1.5-1.5 2.4-3 2.7-.6 3.6-3.7 6.3-7.5 6.3H8c-3.5 0-6-2.3-6-5.5h14.5c1.4 0 2.4-1.3 2.5-4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GenericProviderIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="3.5"
        y="4.5"
        width="17"
        height="15"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M7 9h10M7 12h10M7 15h6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

const PROVIDER_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  "google-genai": GeminiIcon,
  google: GeminiIcon,
  gemini: GeminiIcon,
  openai: OpenAiIcon,
  anthropic: AnthropicIcon,
  cohere: CohereIcon,
  voyage: VoyageIcon,
  "voyage-ai": VoyageIcon,
  mistral: MistralIcon,
  deepseek: DeepSeekIcon,
  groq: GroqIcon,
  huggingface: HuggingFaceIcon,
  "hugging-face": HuggingFaceIcon,
  "clef-local": ClefIcon,
  "clef-api": ClefIcon,
  "laya-local": LayaIcon,
  "jev-api": JevIcon,
  whisper: WhisperIcon,
  "whisper-local": WhisperIcon,
  dmr: DockerIcon,
  llamacpp: LlamaCppIcon,
  nine_router: NineRouterIcon,
  omniroute: OmniRouteIcon,
  "omni-route": OmniRouteIcon,
  ollama: OllamaIcon,
  openrouter: OpenRouterIcon,
  auto: OpenRouterIcon,
};

/** Ícone do provider compartilhado pelo seletor de modelo e pelas configurações. */
export function ProviderIcon({
  provider,
  className,
}: {
  provider: string;
  className?: string;
}) {
  const normalized = provider.toLowerCase().replaceAll("_", "-");
  const Icon =
    PROVIDER_ICONS[provider] ??
    PROVIDER_ICONS[normalized] ??
    GenericProviderIcon;
  return (
    <span
      data-provider-icon={normalized}
      aria-hidden="true"
      className={`inline-flex ${className ?? ""}`}
    >
      <Icon className="size-full" />
    </span>
  );
}
