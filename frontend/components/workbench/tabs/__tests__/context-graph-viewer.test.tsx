// @vitest-environment jsdom
/**
 * ContextGraphViewer — canvas nativo (reagraph) do Context Graph.
 *
 * Testa: hidratação a partir de graph.json, painel de comunidades (toggle +
 * "select all" com estado indeterminado), busca por label, painel de info
 * do nó selecionado com ações explicar/impacto.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
  waitFor,
} from "@testing-library/react";

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy(
    {},
    {
      get:
        (_t, prop) =>
        (..._args: unknown[]) =>
          String(prop),
    },
  ),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

// Captura os props recebidos por GraphCanvas pro teste inspecionar (nós/
// arestas filtrados) e expõe um botão que simula onNodeClick — reagraph
// renderiza um canvas WebGL real via three.js, sem suporte em jsdom.
let lastCanvasProps: Record<string, unknown> | null = null;
function canvasNodes(): unknown[] {
  return (lastCanvasProps?.nodes ?? []) as unknown[];
}
function canvasEdges(): unknown[] {
  return (lastCanvasProps?.edges ?? []) as unknown[];
}
vi.mock("reagraph", () => ({
  GraphCanvas: (props: Record<string, unknown>) => {
    lastCanvasProps = props;
    const nodes = props.nodes as { id: string; data: unknown }[];
    return (
      <div data-testid="graph-canvas-mock">
        {nodes.map((n) => (
          <button
            key={n.id}
            data-testid={`fake-node-${n.id}`}
            onClick={() =>
              (props.onNodeClick as (n: unknown) => void)?.({ data: n.data })
            }
          >
            {n.id}
          </button>
        ))}
      </div>
    );
  },
  lightTheme: { name: "light" },
  darkTheme: { name: "dark" },
}));

afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  cleanup();
  vi.clearAllMocks();
  lastCanvasProps = null;
});

import { ContextGraphViewer } from "../context-graph-viewer";
import type {
  GraphClusterResult,
  GraphQueryResult,
  GraphSymbolResolution,
} from "@/lib/hooks/use-context-graph";

const GRAPH_DATA = {
  nodes: [
    { id: "n1", label: "AuthService", community: 0, community_name: "Auth" },
    { id: "n2", label: "TokenUtils", community: 0, community_name: "Auth" },
    {
      id: "n3",
      label: "PaymentGateway",
      community: 1,
      community_name: "Billing",
    },
  ],
  links: [
    { source: "n1", target: "n2", relation: "calls" },
    { source: "n1", target: "n3", relation: "calls" },
  ],
};

async function renderViewer(
  overrides: {
    fetchGraphData?: () => Promise<typeof GRAPH_DATA | null>;
    clusterGraph?: () => Promise<GraphClusterResult>;
    resolveSymbol?: (symbol: string) => Promise<GraphSymbolResolution>;
    pathBetween?: (
      source: string,
      target: string,
    ) => Promise<GraphQueryResult | null>;
  } = {},
) {
  const onExplainNode = vi.fn();
  const onAffectedNode = vi.fn();
  const fetchGraphData =
    overrides.fetchGraphData ?? vi.fn(() => Promise.resolve(GRAPH_DATA));
  const pathBetween =
    overrides.pathBetween ??
    vi.fn(() =>
      Promise.resolve({
        answer: "Caminho de n1 → n3: 2 nós",
        nodes: [],
        edges: [],
      }),
    );
  const clusterGraph =
    overrides.clusterGraph ??
    vi.fn(() =>
      Promise.resolve({
        communities: [
          { id: 3, name: "Payments", node_ids: ["n1", "n3"] },
          { id: 4, name: "Utilities", node_ids: ["n2"] },
        ],
        node_count: 3,
      }),
    );
  const resolveSymbol =
    overrides.resolveSymbol ??
    vi.fn(() =>
      Promise.resolve({
        status: "resolved" as const,
        query: "AuthService",
        candidates: [
          {
            id: "n1",
            label: "AuthService",
            source_file: "auth.py",
            source_location: "L1",
            community: 0,
          },
        ],
        total: 1,
        truncated: false,
      }),
    );
  render(
    <ContextGraphViewer
      fetchGraphData={fetchGraphData}
      clusterGraph={clusterGraph}
      resolveSymbol={resolveSymbol}
      pathBetween={pathBetween}
      onExplainNode={onExplainNode}
      onAffectedNode={onAffectedNode}
    />,
  );
  await screen.findByTestId("graph-canvas-mock");
  return {
    onExplainNode,
    onAffectedNode,
    fetchGraphData,
    pathBetween,
    clusterGraph,
    resolveSymbol,
  };
}

describe("ContextGraphViewer", () => {
  it("resolve o identificador e permite navegar ao candidato", async () => {
    const { resolveSymbol } = await renderViewer();
    fireEvent.change(screen.getByTestId("graph-search-input"), {
      target: { value: "AuthService" },
    });
    fireEvent.click(screen.getByTestId("graph-symbol-resolve"));
    const candidate = await screen.findByTestId("graph-symbol-candidate");
    expect(resolveSymbol).toHaveBeenCalledWith("AuthService");
    fireEvent.click(candidate);
    expect(await screen.findByText("AuthService")).toBeTruthy();
  });

  it("mostra erro quando a resolução falha", async () => {
    await renderViewer({
      resolveSymbol: vi.fn(() => Promise.reject(new Error("falha"))),
    });
    fireEvent.change(screen.getByTestId("graph-search-input"), {
      target: { value: "AuthService" },
    });
    fireEvent.click(screen.getByTestId("graph-symbol-resolve"));
    expect(await screen.findByRole("alert")).toBeTruthy();
  });

  it("busca o grafo ao montar e passa nós/arestas de todas as comunidades pro canvas", async () => {
    const { fetchGraphData } = await renderViewer();
    expect(fetchGraphData).toHaveBeenCalledTimes(1);
    expect(canvasNodes().length).toBe(3);
    expect(canvasEdges().length).toBe(2);
  });

  it("calcula comunidades sob demanda e aplica o resultado só na visualização", async () => {
    const { clusterGraph } = await renderViewer();
    fireEvent.click(screen.getByTestId("graph-cluster-button"));
    await waitFor(() => expect(screen.getByText("Payments")).toBeTruthy());
    expect(clusterGraph).toHaveBeenCalledOnce();
    expect(canvasNodes()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cluster: "3" }),
        expect.objectContaining({ cluster: "4" }),
      ]),
    );
  });

  it("mostra erro quando o agrupamento falha e preserva os dados visíveis", async () => {
    await renderViewer({
      clusterGraph: () => Promise.reject(new Error("falha")),
    });
    fireEvent.click(screen.getByTestId("graph-cluster-button"));
    expect(await screen.findByTestId("graph-cluster-error")).toBeTruthy();
    expect(canvasNodes()).toHaveLength(3);
  });

  it("fetchGraphData retornando null não quebra — canvas some sem grafo", async () => {
    await renderViewer({ fetchGraphData: () => Promise.resolve(null) });
    expect(screen.queryByTestId("fake-node-n1")).toBeNull();
    expect(canvasNodes().length).toBe(0);
  });

  it("painel de comunidades lista as comunidades com contagem correta", async () => {
    await renderViewer();
    expect(screen.getByText("Auth")).toBeTruthy();
    expect(screen.getByText("Billing")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy(); // Auth tem 2 nós
    expect(screen.getByText("1")).toBeTruthy(); // Billing tem 1 nó
  });

  it("desmarcar uma comunidade remove seus nós/arestas do canvas", async () => {
    await renderViewer();
    fireEvent.click(screen.getByText("Billing"));
    expect(canvasNodes().length).toBe(2);
    // A aresta n1→n3 depende do nó da comunidade oculta — some junto.
    expect(canvasEdges().length).toBe(1);
  });

  it('"select all" desmarcado com uma comunidade oculta fica indeterminado, e reata tudo ao clicar', async () => {
    await renderViewer();
    fireEvent.click(screen.getByText("Billing"));

    const selectAll = screen
      .getByText("graph_communities_select_all")
      .closest("label")
      ?.querySelector("input") as HTMLInputElement;
    expect(selectAll.indeterminate).toBe(true);

    fireEvent.click(selectAll);
    expect(canvasNodes().length).toBe(3);
  });

  it("clicar num nó mostra o painel de info com as ações explicar/impacto", async () => {
    const { onExplainNode, onAffectedNode } = await renderViewer();
    fireEvent.click(screen.getByTestId("fake-node-n1"));

    expect(screen.getByTestId("graph-node-info")).toBeTruthy();
    expect(screen.getByText("AuthService")).toBeTruthy();

    fireEvent.click(screen.getByText("graph_explain_node_button"));
    expect(onExplainNode).toHaveBeenCalledWith("AuthService");

    fireEvent.click(screen.getByText("graph_affected_button"));
    expect(onAffectedNode).toHaveBeenCalledWith("AuthService");
  });

  it("busca filtra por label sem remover nós do canvas (só destaca)", async () => {
    await renderViewer();
    const input = screen.getByTestId("graph-search-input");
    fireEvent.change(input, { target: { value: "payment" } });
    // Busca é um realce local — não remove nós do canvas, só amplia os
    // que combinam (ver comunidade continuando a listar os 3 nós).
    expect(canvasNodes().length).toBe(3);
  });

  it("modo caminho: clicar em dois nós chama pathBetween e mostra a resposta", async () => {
    const { pathBetween } = await renderViewer();

    fireEvent.click(screen.getByTestId("graph-path-toggle"));
    expect(screen.getByText("graph_path_pick_source")).toBeTruthy();

    fireEvent.click(screen.getByTestId("fake-node-n1"));
    expect(screen.getByText("graph_path_pick_target")).toBeTruthy();
    // Enquanto só a origem foi escolhida, nenhuma chamada ainda — clicar no
    // nó de origem de novo não conta como par (edge: mesmo nó não é caminho).
    expect(pathBetween).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("fake-node-n3"));
    await waitFor(() => expect(pathBetween).toHaveBeenCalledWith("n1", "n3"));
    await screen.findByText("Caminho de n1 → n3: 2 nós");

    // Clicar num nó fora do modo caminho não abre o painel de info — o
    // clique nesse momento ainda pertence ao fluxo de caminho.
    expect(screen.queryByTestId("graph-node-info")).toBeNull();
  });

  it("modo caminho: clicar no mesmo nó escolhido como origem não dispara pathBetween", async () => {
    const { pathBetween } = await renderViewer();

    fireEvent.click(screen.getByTestId("graph-path-toggle"));
    fireEvent.click(screen.getByTestId("fake-node-n1"));
    fireEvent.click(screen.getByTestId("fake-node-n1"));

    expect(pathBetween).not.toHaveBeenCalled();
  });

  it('"Limpar" no modo caminho reseta origem/resultado sem sair do modo', async () => {
    await renderViewer();

    fireEvent.click(screen.getByTestId("graph-path-toggle"));
    fireEvent.click(screen.getByTestId("fake-node-n1"));
    fireEvent.click(screen.getByText("graph_path_clear"));

    expect(screen.getByText("graph_path_pick_source")).toBeTruthy();
  });

  it("desligar o modo caminho (toggle de novo) some com a dica e reseta o estado", async () => {
    await renderViewer();

    fireEvent.click(screen.getByTestId("graph-path-toggle"));
    fireEvent.click(screen.getByTestId("fake-node-n1"));
    fireEvent.click(screen.getByTestId("graph-path-toggle"));

    expect(screen.queryByTestId("graph-path-hint")).toBeNull();

    // Depois de desligado, clicar num nó volta a abrir o painel de info
    // normal, em vez de continuar tentando escolher um par de caminho.
    fireEvent.click(screen.getByTestId("fake-node-n1"));
    expect(screen.getByTestId("graph-node-info")).toBeTruthy();
  });
});
