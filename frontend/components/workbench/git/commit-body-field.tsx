"use client";

/**
 * Campo de descrição do commit: uma caixa só, com o texto em cima (que cresce
 * até um limite e depois rola) e, numa faixa própria logo abaixo, os botões de
 * ação (co-autor, gerar, configurações). O texto nunca entra na faixa dos botões.
 */

import { useRef, type KeyboardEvent, type ReactNode } from "react";

import { useAutoGrow } from "@/lib/hooks/use-auto-grow";

/** Altura máxima do texto, em px (cerca de dez linhas). */
export const COMMIT_BODY_MAX_HEIGHT = 168;

interface CommitBodyFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onSubmit?: () => void;
  testId?: string;
  /** Botões da faixa de ações, abaixo do texto. */
  actions?: ReactNode;
}

export function CommitBodyField({
  value,
  onChange,
  placeholder,
  onSubmit,
  testId,
  actions,
}: CommitBodyFieldProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(ref, value, COMMIT_BODY_MAX_HEIGHT);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) onSubmit?.();
  };

  return (
    <div
      data-testid="git-commit-body-box"
      className="flex flex-col rounded-md border border-border/60 bg-background focus-within:ring-1 focus-within:ring-ring"
    >
      <textarea
        ref={ref}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={2}
        data-testid={testId}
        className="w-full resize-none bg-transparent px-3 py-2 text-xs font-mono placeholder:text-muted-foreground/60 focus:outline-none"
      />
      {actions && (
        <div
          data-testid="git-commit-body-actions"
          className="flex shrink-0 items-center gap-1 px-2 pb-1.5 text-muted-foreground"
        >
          {actions}
        </div>
      )}
    </div>
  );
}
