// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { AboutPanel, CREDITED_PROJECTS } from "../about-panel";

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy({}, { get: (_t, prop) => () => String(prop) }),
}));
vi.mock("@/lib/hooks/use-is-desktop", () => ({ useIsDesktop: () => false }));
vi.mock("@/components/settings/distribution-channels", () => ({
  DistributionChannels: () => null,
}));
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => (
    <img alt={props.alt as string} />
  ),
}));

afterEach(cleanup);

describe("Sobre — Créditos", () => {
  it("credita o GitDesktop e o GitHub Desktop com link para a origem", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(<AboutPanel />);

    expect(screen.getByTestId("about-credits")).toBeTruthy();
    expect(
      screen.getByTestId("about-credit-gitdesktop").getAttribute("href"),
    ).toBe("https://github.com/theBGuy/GitDesktop");
    expect(
      screen.getByTestId("about-credit-githubdesktop").getAttribute("href"),
    ).toBe("https://github.com/desktop/desktop");
    vi.unstubAllGlobals();
  });

  it("os links abrem fora do app, sem vazar o opener", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(<AboutPanel />);

    for (const project of CREDITED_PROJECTS) {
      const link = screen.getByTestId(`about-credit-${project.id}`);
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
    }
    vi.unstubAllGlobals();
  });

  it("aponta para os textos completos das licenças", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(<AboutPanel />);

    expect(screen.getByText("about_credits_licenses_hint")).toBeTruthy();
    vi.unstubAllGlobals();
  });
});
