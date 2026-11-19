// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { useConfirm } from "../use-confirm";
import { answerConfirm } from "./answer-confirm";

function Harness({ second = false }: { second?: boolean }) {
  const { confirm, dialog } = useConfirm();
  const [answers, setAnswers] = useState<string[]>([]);
  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          const first = confirm({ message: "Primeira pergunta?" });
          if (second) {
            const next = await confirm({ message: "Segunda pergunta?" });
            setAnswers((a) => [...a, `segunda:${next}`]);
          }
          const firstAnswer = await first;
          setAnswers((a) => [...a, `primeira:${firstAnswer}`]);
        }}
      >
        perguntar
      </button>
      <output data-testid="answers">{answers.join(",")}</output>
      {dialog}
    </div>
  );
}

async function ask() {
  await act(async () => {
    screen.getByText("perguntar").click();
  });
}

describe("useConfirm", () => {
  it("não mostra nada até alguém perguntar", () => {
    render(<Harness />);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("confirmar resolve true e fecha o diálogo", async () => {
    render(<Harness />);
    await ask();
    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "Primeira pergunta?",
    );

    await answerConfirm(true);

    expect(await screen.findByText("primeira:true")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("cancelar resolve false", async () => {
    render(<Harness />);
    await ask();

    await answerConfirm(false);

    expect(await screen.findByText("primeira:false")).toBeInTheDocument();
  });

  it("uma pergunta nova cancela a anterior em vez de deixá-la pendurada", async () => {
    render(<Harness second />);
    await ask();

    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "Segunda pergunta?",
    );
    await answerConfirm(true);

    await waitFor(() => {
      const answers = screen.getByTestId("answers");
      expect(answers).toHaveTextContent("primeira:false");
      expect(answers).toHaveTextContent("segunda:true");
    });
  });

  it("a pergunta em aberto resolve false se o componente sai da tela", async () => {
    let resolved: boolean | null = null;
    function Probe() {
      const { confirm, dialog } = useConfirm();
      return (
        <>
          <button
            type="button"
            onClick={() =>
              void confirm({ message: "x?" }).then((v) => (resolved = v))
            }
          >
            abrir
          </button>
          {dialog}
        </>
      );
    }
    const { unmount } = render(<Probe />);
    await act(async () => {
      screen.getByText("abrir").click();
    });

    unmount();
    await act(async () => Promise.resolve());

    expect(resolved).toBe(false);
  });
});
