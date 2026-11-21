"use client";

/**
 * Documents do GitHub no canvas (PR, issue e run do Actions): como um item da
 * lista vira o descritor guardado na store e como um descritor vira a tela.
 * Vive aqui, e não na rota, para a lista, a rota e os testes usarem o mesmo
 * caminho.
 */

import type { ReactNode } from "react";

import type { CanvasDocumentDescriptor } from "@/lib/stores/windows-store";
import { GithubIssueDetail, GithubPullDetail } from "./github-detail";
import type { GithubItemRef } from "./github-view";
import { GithubRunDetail } from "./run-detail";

/**
 * O descritor de um item aberto pela lista. Guarda só o identificador (o
 * conteúdo é lido ao abrir), e o mesmo item sempre gera o mesmo `id`, então
 * abrir de novo ativa a aba existente em vez de duplicá-la.
 */
export function githubDocumentDescriptor(
  item: GithubItemRef,
  workspaceId: string,
  threadId: string,
): CanvasDocumentDescriptor {
  return {
    id: `${item.kind}:${workspaceId}:${item.number}`,
    kind: item.kind,
    workspaceId,
    threadId,
    title: `#${item.number} ${item.title}`,
    githubNumber: item.number,
  };
}

/** A tela de um document do GitHub, ou `null` se o descritor não é um deles ou está incompleto. */
export function renderGithubDocument(
  document: CanvasDocumentDescriptor,
): ReactNode {
  const { workspaceId, githubNumber } = document;
  if (!workspaceId || !githubNumber) return null;
  switch (document.kind) {
    case "pull-request":
      return (
        <GithubPullDetail
          key={document.id}
          workspaceId={workspaceId}
          number={githubNumber}
        />
      );
    case "issue":
      return (
        <GithubIssueDetail
          key={document.id}
          workspaceId={workspaceId}
          number={githubNumber}
        />
      );
    case "workflow-run":
      return (
        <GithubRunDetail
          key={document.id}
          workspaceId={workspaceId}
          runId={githubNumber}
        />
      );
    default:
      return null;
  }
}
