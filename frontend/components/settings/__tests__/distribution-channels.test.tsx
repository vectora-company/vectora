// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DistributionChannels } from "../distribution-channels";

const CHANNELS = [
  {
    id: "github_release",
    name: "GitHub Releases",
    status: "available",
    note: "Instaladores de cada versão.",
  },
  {
    id: "flathub",
    name: "Flathub",
    status: "build_only",
    note: "Gerado, mas não publicado.",
  },
  {
    id: "winget",
    name: "WinGet",
    status: "planned",
    note: "Ainda não há manifesto.",
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DistributionChannels", () => {
  it("mostra cada canal com o estado real, sem prometer o que não existe", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => CHANNELS }),
    );

    render(<DistributionChannels />);

    expect(await screen.findByText("GitHub Releases")).toBeInTheDocument();
    const statuses = document.querySelectorAll("[data-status]");
    expect([...statuses].map((el) => el.getAttribute("data-status"))).toEqual([
      "available",
      "build_only",
      "planned",
    ]);
  });

  it("não renderiza nada se a lista não carrega", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<DistributionChannels />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("não renderiza nada se a rede falha", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<DistributionChannels />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
