// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ProviderIcon } from "@/components/icons/provider-icons";

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
    expect(icons[0].querySelector("svg path")).toBeInTheDocument();
    expect(icons[1].querySelector("svg rect")).toBeInTheDocument();
  });
});
