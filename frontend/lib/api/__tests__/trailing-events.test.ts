import { describe, expect, it } from "vitest";

import { withTrailingEvents, type StreamEvent } from "../vectora-client";

function evento(type: string, extra: Record<string, unknown> = {}) {
  return { type, ...extra } as unknown as StreamEvent;
}

async function* fonte(
  eventos: StreamEvent[],
  atrasoFinalMs = 0,
): AsyncGenerator<StreamEvent> {
  for (const e of eventos.slice(0, -1)) yield e;
  if (atrasoFinalMs) await new Promise((r) => setTimeout(r, atrasoFinalMs));
  yield eventos[eventos.length - 1];
}

describe("withTrailingEvents", () => {
  it("entrega o done na hora e segue lendo só os arquivos do turno", async () => {
    const recebidos: string[] = [];
    const trailing: StreamEvent[] = [];
    const eventos = [
      evento("token"),
      evento("done"),
      evento("token"),
      evento("turn_files_changed", { run_id: "r1", files: [] }),
    ];
    const lidos: string[] = [];
    for await (const e of withTrailingEvents(fonte(eventos, 20), (t) => {
      trailing.push(t);
    })) {
      lidos.push(e.type);
      recebidos.push(e.type);
      if (e.type === "done") break;
    }

    expect(recebidos).toEqual(["token", "done"]);
    await new Promise((r) => setTimeout(r, 100));
    expect(trailing.map((t) => t.type)).toEqual(["turn_files_changed"]);
  });

  it("sem done encerra a fonte quando o consumidor sai", async () => {
    let fechada = false;
    async function* origem(): AsyncGenerator<StreamEvent> {
      try {
        yield evento("token");
        yield evento("token");
      } finally {
        fechada = true;
      }
    }
    const leitor = withTrailingEvents(origem(), () => {});
    await leitor.next();
    await leitor.return(undefined);
    expect(fechada).toBe(true);
  });

  it("desiste da espera pela lista quando passa do prazo", async () => {
    const trailing: StreamEvent[] = [];
    const eventos = [
      evento("done"),
      evento("turn_files_changed", { run_id: "r1", files: [] }),
    ];
    for await (const e of withTrailingEvents(
      fonte(eventos, 200),
      (t) => {
        trailing.push(t);
      },
      30,
    )) {
      if (e.type === "done") break;
    }
    await new Promise((r) => setTimeout(r, 300));
    expect(trailing).toEqual([]);
  });
});
