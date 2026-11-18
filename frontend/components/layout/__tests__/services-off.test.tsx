// @vitest-environment jsdom
/**
 * `--no-services` na interface: o aviso, o banner de licença e a cobrança dizem
 * que o Services está desligado nesta execução em vez de mostrar um erro de rede.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { LicenseBanner } from "../license-banner";
import { ServicesOffNotice } from "../services-off-notice";
import { BillingPanel } from "@/components/settings/billing-panel";
import { servicesDisabled, type LicenseStatus } from "@/lib/queries/license";

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy(
    {},
    {
      get: (_t, name: string) => (args?: { n?: number }) =>
        args?.n !== undefined ? `${name}:${args.n}` : name,
    },
  ),
}));

const license = (over: Partial<LicenseStatus> = {}): LicenseStatus => ({
  configured: true,
  tier: "pro",
  status: "active",
  days_remaining: 30,
  expires_at: "2026-12-31",
  cached: true,
  services_enabled: true,
  ...over,
});

function respondWith(body: LicenseStatus) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => body })),
  );
}

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

beforeEach(() => respondWith(license()));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("servicesDisabled", () => {
  it("só é verdadeiro quando o servidor disse que está desligado", () => {
    expect(servicesDisabled(license({ services_enabled: false }))).toBe(true);
    expect(servicesDisabled(license({ services_enabled: true }))).toBe(false);
  });

  it("sem a informação presume ligado: nada some por falta de resposta", () => {
    const antigo = license();
    delete antigo.services_enabled;
    expect(servicesDisabled(antigo)).toBe(false);
    expect(servicesDisabled(null)).toBe(false);
    expect(servicesDisabled(undefined)).toBe(false);
  });
});

describe("ServicesOffNotice", () => {
  it("explica que o Services está desligado nesta execução", async () => {
    respondWith(license({ services_enabled: false }));

    renderWithQuery(<ServicesOffNotice />);

    expect(await screen.findByTestId("services-off-notice")).toHaveTextContent(
      "services_off_notice",
    );
  });

  it("com o Services ligado não renderiza nada", async () => {
    const { container } = renderWithQuery(<ServicesOffNotice />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

describe("LicenseBanner", () => {
  it("mostra o aviso informativo no lugar de renovar ou gerenciar", async () => {
    respondWith(
      license({ services_enabled: false, status: "expired", tier: "pro" }),
    );

    renderWithQuery(<LicenseBanner />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "services_off_notice",
    );
    // Um botão de renovar abriria o portal, que responderia 503.
    expect(screen.queryByText("license_banner_renew")).toBeNull();
    expect(screen.queryByText("license_banner_manage")).toBeNull();
  });

  it("o aviso pode ser dispensado", async () => {
    respondWith(license({ services_enabled: false }));
    renderWithQuery(<LicenseBanner />);
    const botao = await screen.findByLabelText("license_dismiss");

    botao.click();

    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });

  it("com o Services ligado e licença vencida continua oferecendo renovar", async () => {
    respondWith(license({ status: "expired" }));

    renderWithQuery(<LicenseBanner />);

    expect(await screen.findByText("license_banner_renew")).toBeInTheDocument();
    expect(screen.queryByText("services_off_notice")).toBeNull();
  });
});

describe("BillingPanel", () => {
  it("com o Services desligado só explica, sem botão de portal", async () => {
    respondWith(license({ services_enabled: false }));

    renderWithQuery(<BillingPanel />);

    expect(
      await screen.findByTestId("services-off-notice"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
