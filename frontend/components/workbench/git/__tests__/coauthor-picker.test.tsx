// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";

import { CoAuthorPicker } from "../coauthor-picker";

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy({}, { get: (_t, prop) => () => String(prop) }),
}));

const people = [
  { name: "Ana Souza", email: "ana@example.com", username: null, commits: 9 },
  {
    name: "Bruno",
    email: "1+bruno@users.noreply.github.com",
    username: "bruno",
  },
];

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => people });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function Harness({ initial = "" }: { initial?: string }) {
  const [body, setBody] = useState(initial);
  return (
    <>
      <CoAuthorPicker workspaceId="ws1" body={body} onBodyChange={setBody} />
      <output data-testid="body">{body}</output>
    </>
  );
}

const open = async () => {
  fireEvent.click(screen.getByTestId("git-coauthor-button"));
  await screen.findByTestId("git-coauthor-ana@example.com");
};
const body = () => screen.getByTestId("body").textContent;

describe("CoAuthorPicker", () => {
  it("lista as pessoas do repositório ao abrir (antes dizia 'nenhum usuário')", async () => {
    render(<Harness />);

    await open();

    expect(screen.getByText("Ana Souza")).toBeTruthy();
    expect(screen.getByText("@bruno")).toBeTruthy();
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "/workspaces/ws1/git/contributors?q=",
    );
  });

  it("escolher uma pessoa acrescenta o Co-authored-by ao corpo", async () => {
    render(<Harness initial="Corrige o bug." />);
    await open();

    fireEvent.click(screen.getByTestId("git-coauthor-ana@example.com"));

    expect(body()).toBe(
      "Corrige o bug.\n\nCo-authored-by: Ana Souza <ana@example.com>",
    );
  });

  it("clicar de novo na mesma pessoa a remove, e ela aparece marcada enquanto está no corpo", async () => {
    render(<Harness />);
    await open();
    const option = screen.getByTestId("git-coauthor-ana@example.com");

    fireEvent.click(option);
    expect(option.getAttribute("aria-selected")).toBe("true");

    fireEvent.click(option);
    expect(option.getAttribute("aria-selected")).toBe("false");
    expect(body()).toBe("");
  });

  it("pessoas já presentes no corpo vêm marcadas", async () => {
    render(
      <Harness initial={"x\n\nCo-authored-by: Ana Souza <ana@example.com>"} />,
    );
    await open();

    expect(
      screen
        .getByTestId("git-coauthor-ana@example.com")
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("buscar consulta o servidor com o texto, depois de uma pequena pausa", async () => {
    render(<Harness />);
    await open();
    fetchMock.mockClear();

    fireEvent.change(screen.getByTestId("git-coauthor-search"), {
      target: { value: "bru no" },
    });
    expect(fetchMock).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/workspaces/ws1/git/contributors?q=bru%20no",
        expect.anything(),
      ),
    );
  });

  it("digitar rápido faz uma única consulta (não uma por letra)", async () => {
    vi.useFakeTimers();
    render(<Harness />);
    fireEvent.click(screen.getByTestId("git-coauthor-button"));
    await act(async () => vi.advanceTimersByTime(300));
    fetchMock.mockClear();

    for (const text of ["a", "an", "ana"])
      fireEvent.change(screen.getByTestId("git-coauthor-search"), {
        target: { value: text },
      });
    await act(async () => vi.advanceTimersByTime(300));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toContain("q=ana");
  });

  it("sem resultado explica que dá para procurar pelo usuário do GitHub", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    render(<Harness />);
    fireEvent.click(screen.getByTestId("git-coauthor-button"));

    expect(await screen.findByTestId("git-coauthor-empty")).toBeTruthy();
  });

  it("mostra um erro quando o servidor falha", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => [] });
    render(<Harness />);
    fireEvent.click(screen.getByTestId("git-coauthor-button"));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "workbench_git_coauthor_error",
    );
  });

  it("Esc e clique fora fecham o painel", async () => {
    render(<Harness />);
    await open();

    fireEvent.keyDown(screen.getByTestId("git-coauthor-search"), {
      key: "Escape",
    });
    expect(screen.queryByTestId("git-coauthor-panel")).toBeNull();

    await open();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByTestId("git-coauthor-panel")).toBeNull();
  });
});
