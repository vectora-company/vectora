import { describe, it, expect } from "vitest";
import { historyMessageToMessage } from "../message-helpers";
import type { HistoryMessage } from "../../../api/vectora-client";

describe("historyMessageToMessage", () => {
  it("converte uma mensagem humana simples sem anexos", () => {
    const hist: HistoryMessage = {
      role: "human",
      content: "oi",
      created_at: "2026-01-01T00:00:00Z",
      checkpoint_id: "cp1",
    };

    const msg = historyMessageToMessage(hist, "id-1");

    expect(msg.id).toBe("id-1");
    expect(msg.role).toBe("user");
    expect(msg.content).toBe("oi");
    expect(msg.checkpointId).toBe("cp1");
    expect(msg.images).toBeUndefined();
  });

  it("propaga is_error do histórico persistido para isError", () => {
    const failed = historyMessageToMessage(
      { role: "assistant", content: "[falha] provider", is_error: true },
      "id-err",
    );
    expect(failed.isError).toBe(true);

    // false e null (estado desconhecido) nunca marcam a mensagem como erro.
    for (const is_error of [false, null, undefined]) {
      const ok = historyMessageToMessage(
        { role: "assistant", content: "ok", is_error },
        "id-ok",
      );
      expect(ok.isError).toBeUndefined();
    }
  });

  it("mapeia role 'assistant' corretamente", () => {
    const hist: HistoryMessage = { role: "assistant", content: "olá!" };

    const msg = historyMessageToMessage(hist, "id-2");

    expect(msg.role).toBe("assistant");
  });

  it("popula images a partir de attachments com kind=image e url", () => {
    const hist: HistoryMessage = {
      role: "human",
      content: "veja essa imagem",
      attachments: [
        {
          name: "screenshot.png",
          mimeType: "image/png",
          kind: "image",
          size: 2048,
          url: "/threads/t1/attachments/abc.png",
        },
      ],
    };

    const msg = historyMessageToMessage(hist, "id-3");

    expect(msg.images).toHaveLength(1);
    expect(msg.images?.[0]).toEqual({
      id: "/threads/t1/attachments/abc.png",
      url: "/threads/t1/attachments/abc.png",
      mimeType: "image/png",
      name: "screenshot.png",
      size: 2048,
    });
  });

  it("attachment de imagem sem url (falha ao persistir) não vira image — mensagem continua exibível", () => {
    const hist: HistoryMessage = {
      role: "human",
      content: "veja essa imagem",
      attachments: [
        {
          name: "screenshot.png",
          mimeType: "image/png",
          kind: "image",
          size: 2048,
          url: null,
        },
      ],
    };

    const msg = historyMessageToMessage(hist, "id-4");

    expect(msg.images).toBeUndefined();
    expect(msg.content).toBe("veja essa imagem");
  });

  it("anexo que não é imagem volta como cartão de arquivo, com ou sem url", () => {
    const hist: HistoryMessage = {
      role: "human",
      content: "leia esse arquivo",
      attachments: [
        {
          name: "doc.pdf",
          mimeType: "application/pdf",
          kind: "document",
          size: 1024,
          url: "/threads/t1/assets/abc",
        },
        {
          name: "notas.txt",
          mimeType: "text/plain",
          kind: "text",
          size: 12,
        },
      ],
    };

    const msg = historyMessageToMessage(hist, "id-5");

    expect(msg.images).toEqual([
      {
        id: "/threads/t1/assets/abc",
        url: "/threads/t1/assets/abc",
        mimeType: "application/pdf",
        name: "doc.pdf",
        size: 1024,
      },
      {
        id: "id-5:attachment:1",
        url: "",
        mimeType: "text/plain",
        name: "notas.txt",
        size: 12,
      },
    ]);
  });

  it("múltiplos anexos de imagem viram múltiplas entradas em images", () => {
    const hist: HistoryMessage = {
      role: "human",
      content: "compare essas duas",
      attachments: [
        {
          name: "a.png",
          mimeType: "image/png",
          kind: "image",
          size: 10,
          url: "/threads/t1/attachments/a.png",
        },
        {
          name: "b.png",
          mimeType: "image/png",
          kind: "image",
          size: 20,
          url: "/threads/t1/attachments/b.png",
        },
      ],
    };

    const msg = historyMessageToMessage(hist, "id-6");

    expect(msg.images).toHaveLength(2);
    expect(msg.images?.map((i) => i.name)).toEqual(["a.png", "b.png"]);
  });

  it("sem created_at usa a hora atual como timestamp", () => {
    const hist: HistoryMessage = { role: "human", content: "oi" };

    const before = Date.now();
    const msg = historyMessageToMessage(hist, "id-7");
    const after = Date.now();

    expect(msg.timestamp.getTime()).toBeGreaterThanOrEqual(before);
    expect(msg.timestamp.getTime()).toBeLessThanOrEqual(after);
  });
});

describe("historyMessageToMessage — partes", () => {
  it("devolve o raciocínio persistido na mensagem recarregada", () => {
    const message = historyMessageToMessage(
      {
        role: "assistant",
        content: "Pronto",
        parts: [{ kind: "reasoning", text: "analisei o pedido" }],
      },
      "h1",
    );

    expect(message.reasoning).toBe("analisei o pedido");
    expect(message.toolCalls).toBeUndefined();
  });

  it("reconstrói a tool call com argumentos, saída e metadados da UI", () => {
    const message = historyMessageToMessage(
      {
        role: "assistant",
        content: "",
        parts: [
          {
            kind: "tool_call",
            tool_call_id: "c1",
            tool_name: "read_file",
            args_json: '{"path":"a.py"}',
            render_hint: "code_block",
            category: "filesystem",
            icon: "file",
            result_json: '{"content":"print(1)"}',
            is_error: false,
          },
        ],
      },
      "h2",
    );

    expect(message.toolCalls).toEqual([
      {
        id: "c1",
        name: "read_file",
        args: { path: "a.py" },
        output: { content: "print(1)" },
        isError: false,
        renderHint: "code_block",
        category: "filesystem",
        destructive: false,
        icon: "file",
      },
    ]);
  });

  it("deixa a saída em aberto quando a tool não terminou", () => {
    const message = historyMessageToMessage(
      {
        role: "assistant",
        content: "",
        parts: [
          {
            kind: "tool_call",
            tool_call_id: "c2",
            tool_name: "terminal",
            args_json: "not json",
            result_json: null,
          },
        ],
      },
      "h3",
    );

    expect(message.toolCalls?.[0].output).toBeUndefined();
    expect(message.toolCalls?.[0].args).toEqual({ _raw: "not json" });
    expect(message.toolCalls?.[0].renderHint).toBe("json");
  });

  it("não cria campos quando a mensagem não tem partes", () => {
    const message = historyMessageToMessage(
      { role: "assistant", content: "Pronto" },
      "h4",
    );

    expect(message.reasoning).toBeUndefined();
    expect(message.toolCalls).toBeUndefined();
  });
});

describe("historyMessageToMessage — verificação", () => {
  it("devolve o desfecho da verificação do turno", () => {
    const message = historyMessageToMessage(
      {
        role: "assistant",
        content: "Feito",
        verification: { status: "degraded", outcome: "not_run" },
      },
      "h5",
    );

    expect(message.verification).toEqual({
      status: "degraded",
      outcome: "not_run",
      detail: "",
    });
  });
});
