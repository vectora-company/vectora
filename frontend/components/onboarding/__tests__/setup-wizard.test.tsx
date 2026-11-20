// @vitest-environment jsdom

/**
 * Passos compartilhados do onboarding (StepToken/StepMode/StepApiKeys/
 * StepWorkspace/StepMemory/StepCapabilities) — portados de um Dialog próprio
 * (SetupWizard, removido) pra continuação do PreAuthWizard. Testados
 * isoladamente, renderizando cada passo direto (sem a máquina de passos, que
 * é responsabilidade do PreAuthWizard).
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import {
  StepToken,
  StepMode,
  StepApiKeys,
  StepWorkspace,
  StepMemory,
  StepCapabilities,
} from "../setup-wizard";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ has_token: false, mode: "lite" }),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** As telas leem o status de licença pelo cache de queries. */
function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

describe("StepToken sem Services", () => {
  it("avisa que o Services está desligado nesta execução", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ services_enabled: false, configured: false }),
      })),
    );

    renderWithQuery(<StepToken />);

    expect(
      await screen.findByTestId("services-off-notice"),
    ).toBeInTheDocument();
  });

  it("com o Services ligado não mostra o aviso", async () => {
    renderWithQuery(<StepToken />);

    await screen.findByPlaceholderText("vct_…");
    expect(screen.queryByTestId("services-off-notice")).toBeNull();
  });
});

describe("StepToken", () => {
  it("campo de token usa autocomplete=new-password para desabilitar o autofill/sugestão de senha salva do browser", async () => {
    // "off" é ignorado por Chrome/Edge em campos type="password" desde 2014
    // (o browser mostra a sugestão de senha salva mesmo assim) — o valor
    // que de fato suprime isso é "new-password".
    renderWithQuery(<StepToken />);
    const input = await screen.findByPlaceholderText("vct_…");
    expect(input).toHaveAttribute("autocomplete", "new-password");
  });

  it("erro: campo de token não deve ter hint semântico que reative sugestões do browser", async () => {
    renderWithQuery(<StepToken />);
    const input = await screen.findByPlaceholderText("vct_…");
    expect(input).not.toHaveAttribute("autocomplete", "off");
    expect(input).not.toHaveAttribute("autocomplete", "current-password");
    expect(input).not.toHaveAttribute("autocomplete", "email");
  });
});

function mockStorageFetch(opts: {
  defaultsOk: boolean;
}): ReturnType<typeof vi.fn> {
  const defaults = {
    postgres: {
      url: "postgresql+asyncpg://vectora:vectora@localhost:5432/vectora",
      start_command: "docker compose up -d postgres",
    },
    redis: {
      url: "redis://:vectora@localhost:6379/0",
      start_command: "docker compose up -d redis",
    },
    qdrant: {
      url: "http://localhost:6333",
      api_key: "vectora",
      start_command: "docker compose up -d qdrant",
    },
  };
  return vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes("/admin/storage/defaults")) {
      return {
        ok: opts.defaultsOk,
        json: async () => (opts.defaultsOk ? defaults : {}),
      };
    }
    if (u.includes("/admin/storage")) {
      return {
        ok: true,
        json: async () => ({
          config: {
            storage_mode: "lite",
            postgres_configured: false,
            redis_configured: false,
            qdrant_configured: false,
          },
        }),
      };
    }
    if (u.includes("/admin/api-keys/test")) {
      return { ok: true, json: async () => ({ ok: true }) };
    }
    if (u.includes("/admin/api-keys")) {
      return {
        ok: true,
        json: async () => ({
          google: { configured: false, masked: "" },
          cohere: { configured: false, masked: "" },
          tavily: { configured: false, masked: "" },
        }),
      };
    }
    return { ok: true, json: async () => ({ has_token: false, mode: "lite" }) };
  });
}

describe("StepMode — pré-preenchimento com defaults reais", () => {
  it("pré-preenche o card com a URL default e o comando self-hosted", async () => {
    vi.stubGlobal("fetch", mockStorageFetch({ defaultsOk: true }));
    render(<StepMode />);
    fireEvent.click(await screen.findByText("Complete"));

    await waitFor(() =>
      expect(
        screen.getByDisplayValue("redis://:vectora@localhost:6379/0"),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByDisplayValue("docker compose up -d redis"),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("vectora")).toBeInTheDocument();
  });

  it("erro: sem defaults do backend, o card fica vazio (só placeholder)", async () => {
    vi.stubGlobal("fetch", mockStorageFetch({ defaultsOk: false }));
    render(<StepMode />);
    fireEvent.click(await screen.findByText("Complete"));

    const input = (await screen.findByPlaceholderText(
      "redis://localhost:6379/0",
    )) as HTMLInputElement;
    expect(input.value).toBe("");
  });
});

describe("StepMode — storage completo permanece disponível no Free", () => {
  it("usuário Free consegue selecionar Completo e configurar os próprios serviços", async () => {
    const fetchMock = mockStorageFetch({ defaultsOk: true });
    vi.stubGlobal("fetch", fetchMock);
    render(<StepMode />);

    const completeBtn = (await screen.findByText("Complete")).closest(
      "button",
    )!;
    expect(completeBtn).toBeEnabled();

    fireEvent.click(completeBtn);
    expect(
      await screen.findByDisplayValue("redis://:vectora@localhost:6379/0"),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/admin/storage",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("mantém configuração completa sem rótulos de assinatura", async () => {
    vi.stubGlobal("fetch", mockStorageFetch({ defaultsOk: true }));
    render(<StepMode />);
    fireEvent.click(await screen.findByText("Complete"));

    await waitFor(() =>
      expect(
        screen.getByDisplayValue("redis://:vectora@localhost:6379/0"),
      ).toBeInTheDocument(),
    );
  });
});

// ---------------------------------------------------------------------------
// StepApiKeys
// ---------------------------------------------------------------------------

function mockApiKeysFetch(
  opts: {
    google?: { configured: boolean; masked: string };
    cohere?: { configured: boolean; masked: string };
    tavily?: { configured: boolean; masked: string };
    testOk?: boolean;
  } = {},
) {
  const {
    google = { configured: false, masked: "" },
    cohere = { configured: false, masked: "" },
    tavily = { configured: false, masked: "" },
    testOk = true,
  } = opts;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/admin/api-keys/test")) {
        return {
          ok: true,
          json: async () => ({
            ok: testOk,
            error: testOk ? "" : "Invalid key",
          }),
        };
      }
      if (u.includes("/admin/api-keys") && init?.method === "PATCH") {
        return {
          ok: true,
          json: async () => ({ status: "updated", updated: [] }),
        };
      }
      if (u.includes("/admin/api-keys")) {
        return { ok: true, json: async () => ({ google, cohere, tavily }) };
      }
      return { ok: true, json: async () => ({}) };
    }),
  );
}

describe("StepApiKeys", () => {
  it("renderiza os 3 campos de chave", async () => {
    mockApiKeysFetch();
    render(<StepApiKeys />);
    expect(await screen.findByPlaceholderText("AIza…")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("…")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("tvly-…")).toBeInTheDocument();
  });

  it("erro: campos sem valor configurado ficam vazios", async () => {
    mockApiKeysFetch();
    render(<StepApiKeys />);
    for (const placeholder of ["AIza…", "…", "tvly-…"]) {
      const input = (await screen.findByPlaceholderText(
        placeholder,
      )) as HTMLInputElement;
      expect(input.value).toBe("");
    }
  });

  it("pré-preenche masked value quando key está configurada", async () => {
    mockApiKeysFetch({ google: { configured: true, masked: "AIzaS•••e7wQ" } });
    render(<StepApiKeys />);
    await waitFor(() => {
      const input = screen.getByPlaceholderText("AIza…") as HTMLInputElement;
      expect(input.value).toBe("AIzaS•••e7wQ");
    });
  });

  it("ao desfocar campo com valor, chama PATCH + test", async () => {
    mockApiKeysFetch();
    render(<StepApiKeys />);
    const fetchMock = vi.mocked(global.fetch);
    const input = await screen.findByPlaceholderText("tvly-…");
    fireEvent.change(input, { target: { value: "tvly-abc123" } });
    fireEvent.blur(input);
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(
        calls.some((u) => u.includes("/admin/api-keys") && !u.includes("test")),
      ).toBe(true);
      expect(calls.some((u) => u.includes("/admin/api-keys/test"))).toBe(true);
    });
  });

  it("erro: campo desativado sem valor não dispara PATCH nem test", async () => {
    mockApiKeysFetch();
    render(<StepApiKeys />);
    const fetchMock = vi.mocked(global.fetch);
    const input = await screen.findByPlaceholderText("tvly-…");
    const countBefore = fetchMock.mock.calls.length;
    fireEvent.blur(input);
    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBe(countBefore);
    });
  });

  it("mostra a alternativa 100% local via Ollama sem exigir preencher nenhuma chave", async () => {
    mockApiKeysFetch();
    render(<StepApiKeys />);
    expect(await screen.findByText(/Ollama/)).toBeInTheDocument();
    expect(screen.getByText(/Provider Routing/)).toBeInTheDocument();
    expect(screen.queryByText(/Gateways/)).toBeNull();
  });
});

function mockRouterFetch(
  opts: {
    status?: { configured: boolean; base_url?: string; masked?: string };
    reachable?: boolean;
    saveOk?: boolean;
  } = {},
) {
  const {
    status = { configured: false },
    reachable = true,
    saveOk = true,
  } = opts;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/provider-routing/nine-router/status")) {
      return { ok: true, json: async () => status };
    }
    if (
      u.includes("/provider-routing/nine-router/config") &&
      init?.method === "POST"
    ) {
      return { ok: saveOk, json: async () => ({ configured: true }) };
    }
    if (u.includes("/provider-routing/nine-router/models")) {
      return { ok: true, json: async () => ({ reachable, models: [] }) };
    }
    return { ok: true, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("StepApiKeys — roteador recomendado", () => {
  it("mostra o roteador em destaque antes das chaves diretas", async () => {
    mockRouterFetch();
    render(<StepApiKeys />);

    const section = await screen.findByTestId("router-setup");
    expect(section.textContent).toContain("Recommended");
    expect(section.textContent).toMatch(/9Router/);
    expect(section.textContent).toMatch(/OmniRoute/);
    expect(
      screen.getByPlaceholderText("http://localhost:20128/v1"),
    ).toBeInTheDocument();
  });

  it("salva endereço e chave juntos e confirma a conexão", async () => {
    const fetchMock = mockRouterFetch({ reachable: true });
    render(<StepApiKeys />);

    fireEvent.change(
      await screen.findByPlaceholderText("http://localhost:20128/v1"),
      { target: { value: "http://localhost:20128/v1/" } },
    );
    fireEvent.change(screen.getByPlaceholderText("sk-…"), {
      target: { value: "sk-router" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Connected")).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).includes("/nine-router/config") && init?.method === "POST",
    );
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      base_url: "http://localhost:20128/v1/",
      api_key: "sk-router",
    });
  });

  it("avisa quando o roteador foi salvo mas não responde", async () => {
    mockRouterFetch({ reachable: false });
    render(<StepApiKeys />);

    fireEvent.change(
      await screen.findByPlaceholderText("http://localhost:20128/v1"),
      { target: { value: "http://localhost:9/v1" } },
    );
    fireEvent.change(screen.getByPlaceholderText("sk-…"), {
      target: { value: "sk-x" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/did not respond/)).toBeInTheDocument();
  });

  it("não deixa salvar com campo vazio", async () => {
    mockRouterFetch();
    render(<StepApiKeys />);

    const save = await screen.findByRole("button", { name: "Save" });
    expect((save as HTMLButtonElement).disabled).toBe(true);
  });

  it("pré-preenche o roteador já configurado", async () => {
    mockRouterFetch({
      status: {
        configured: true,
        base_url: "http://localhost:20128/v1",
        masked: "sk-r•••ter",
      },
    });
    render(<StepApiKeys />);

    await waitFor(() => {
      const url = screen.getByPlaceholderText(
        "http://localhost:20128/v1",
      ) as HTMLInputElement;
      expect(url.value).toBe("http://localhost:20128/v1");
    });
    expect(await screen.findByText("Connected")).toBeInTheDocument();
  });
});

describe("StepWorkspace — bullet do Sandbox", () => {
  it("renderiza o bullet explicando o isolamento por workspace via [sandbox]", () => {
    render(<StepWorkspace />);
    expect(screen.getByText(/vectora\.toml/)).toBeInTheDocument();
  });
});

describe("StepMemory — três camadas", () => {
  it("renderiza memória de conversa, Remember e RAG/Deep Memory", () => {
    render(<StepMemory />);
    expect(
      screen.getByText((_, el) => el?.textContent === "Conversation memory"),
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, el) => el?.textContent === "Remember"),
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, el) => el?.textContent === "Deep Memory (RAG)"),
    ).toBeInTheDocument();
  });
});

describe("StepCapabilities", () => {
  it("renderiza a introdução de capacidades do agente", () => {
    render(<StepCapabilities />);
    expect(screen.getByText(/Sandbox/)).toBeInTheDocument();
  });
});
