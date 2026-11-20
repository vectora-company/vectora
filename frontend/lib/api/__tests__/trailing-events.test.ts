import { describe, expect, it } from "vitest";

import { withTrailingEvents, type StreamEvent } from "../vectora-client";

function makeEvent(type: string, extra: Record<string, unknown> = {}) {
  return { type, ...extra } as unknown as StreamEvent;
}

async function* source(
  events: StreamEvent[],
  finalDelayMs = 0,
): AsyncGenerator<StreamEvent> {
  for (const e of events.slice(0, -1)) yield e;
  if (finalDelayMs) await new Promise((r) => setTimeout(r, finalDelayMs));
  yield events[events.length - 1];
}

describe("withTrailingEvents", () => {
  it("entrega o done na hora e segue lendo só os arquivos do turno", async () => {
    const received: string[] = [];
    const trailing: StreamEvent[] = [];
    const events = [
      makeEvent("token"),
      makeEvent("done"),
      makeEvent("token"),
      makeEvent("turn_files_changed", { run_id: "r1", files: [] }),
    ];
    const read: string[] = [];
    for await (const e of withTrailingEvents(source(events, 20), (t) => {
      trailing.push(t);
    })) {
      read.push(e.type);
      received.push(e.type);
      if (e.type === "done") break;
    }

    expect(received).toEqual(["token", "done"]);
    await new Promise((r) => setTimeout(r, 100));
    expect(trailing.map((t) => t.type)).toEqual(["turn_files_changed"]);
  });

  it("sem done encerra a fonte quando o consumidor sai", async () => {
    let closed = false;
    async function* upstream(): AsyncGenerator<StreamEvent> {
      try {
        yield makeEvent("token");
        yield makeEvent("token");
      } finally {
        closed = true;
      }
    }
    const reader = withTrailingEvents(upstream(), () => {});
    await reader.next();
    await reader.return(undefined);
    expect(closed).toBe(true);
  });

  it("desiste da espera pela lista quando passa do prazo", async () => {
    const trailing: StreamEvent[] = [];
    const events = [
      makeEvent("done"),
      makeEvent("turn_files_changed", { run_id: "r1", files: [] }),
    ];
    for await (const e of withTrailingEvents(
      source(events, 200),
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
