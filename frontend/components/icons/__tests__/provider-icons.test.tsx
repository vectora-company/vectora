// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ProviderIcon } from "@/components/icons/provider-icons";
import { useSettingsStore } from "@/lib/stores/settings-store";
import clef from "@/assets/provider-logos/clef.png";
import jevOnDark from "@/assets/provider-logos/jev-on-dark.png";
import jevOnLight from "@/assets/provider-logos/jev-on-light.png";
import laya from "@/assets/provider-logos/laya.svg";
import huggingface from "@/assets/provider-logos/huggingface.svg";
import llamacppOnDark from "@/assets/provider-logos/llamacpp-on-dark.svg";
import llamacppOnLight from "@/assets/provider-logos/llamacpp-on-light.svg";
import ninerouter from "@/assets/provider-logos/ninerouter.svg";
import ollamaOnDark from "@/assets/provider-logos/ollama-on-dark.svg";
import ollamaOnLight from "@/assets/provider-logos/ollama-on-light.svg";
import omniroute from "@/assets/provider-logos/omniroute.svg";

describe("ProviderIcon", () => {
  it("seleciona o SVG específico de cada provider reconhecido", () => {
    const { container } = render(
      <>
        <ProviderIcon provider="google-genai" className="size-4" />
        <ProviderIcon provider="openai" className="size-4" />
        <ProviderIcon provider="cohere" className="size-4" />
        <ProviderIcon provider="voyage" className="size-4" />
        <ProviderIcon provider="mistral" className="size-4" />
      </>,
    );

    expect(
      [...container.querySelectorAll("[data-provider-icon]")].map((icon) =>
        icon.getAttribute("data-provider-icon"),
      ),
    ).toEqual(["google-genai", "openai", "cohere", "voyage", "mistral"]);
    const paths = [...container.querySelectorAll("svg path")].map((path) =>
      path.getAttribute("d"),
    );
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("normaliza aliases e mostra um ícone neutro para providers desconhecidos", () => {
    const { container } = render(
      <>
        <ProviderIcon provider="nine_router" />
        <ProviderIcon provider="unlisted-provider" />
      </>,
    );

    const icons = container.querySelectorAll("[data-provider-icon]");
    expect(icons[0]).toHaveAttribute("data-provider-icon", "nine-router");
    expect(icons[0].querySelector("img")?.getAttribute("src")).toBe(ninerouter);
    expect(icons[1].querySelector("svg rect")).toBeInTheDocument();
  });

  it("usa o logo oficial de cada provider que tem arquivo de origem", () => {
    useSettingsStore.getState().setTheme("dark");
    const { container } = render(
      <>
        <ProviderIcon provider="ollama" />
        <ProviderIcon provider="llamacpp" />
        <ProviderIcon provider="huggingface" />
        <ProviderIcon provider="nine_router" />
        <ProviderIcon provider="omniroute" />
        <ProviderIcon provider="laya-local" />
        <ProviderIcon provider="clef-local" />
        <ProviderIcon provider="jev-api" />
      </>,
    );

    const sources = [
      ...container.querySelectorAll("[data-provider-icon] img"),
    ].map((img) => img.getAttribute("src") ?? "");
    expect(sources).toHaveLength(8);
    expect(sources).toEqual([
      ollamaOnDark,
      llamacppOnDark,
      huggingface,
      ninerouter,
      omniroute,
      laya,
      clef,
      jevOnDark,
    ]);
  });

  it("troca a variante do glifo de uma cor conforme o tema", () => {
    useSettingsStore.getState().setTheme("light");
    const { container } = render(
      <>
        <ProviderIcon provider="ollama" />
        <ProviderIcon provider="llamacpp" />
        <ProviderIcon provider="jev-api" />
      </>,
    );

    const sources = [...container.querySelectorAll("img")].map(
      (img) => img.getAttribute("src") ?? "",
    );
    expect(sources).toEqual([ollamaOnLight, llamacppOnLight, jevOnLight]);
    // As duas variantes são arquivos diferentes (glifo claro x escuro).
    expect(ollamaOnLight).not.toBe(ollamaOnDark);
    expect(llamacppOnLight).not.toBe(llamacppOnDark);
    useSettingsStore.getState().setTheme("dark");
  });

  it("não deixa ícone feito à mão onde há logo oficial", () => {
    const { container } = render(<ProviderIcon provider="llamacpp" />);

    expect(container.querySelector("svg")).toBeNull();
  });
});
