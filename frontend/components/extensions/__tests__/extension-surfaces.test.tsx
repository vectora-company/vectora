// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ExtensionHeaderActions } from "@/components/header/extension-header-actions";
import { ExtensionModeButtons } from "@/components/header/extension-mode-buttons";
import { ExtensionModeSurface } from "../extension-mode-surface";
import { FileIcon } from "@/components/icons/file-icon";
import { buildSettingsCategoryGroups } from "@/components/settings/settings-categories";
import type { ExtensionContribution } from "@/lib/extensions/registry";
import { useExtensionsStore } from "@/lib/stores/extensions-store";

function make(
  kind: ExtensionContribution["kind"],
  id: string,
  extra: Partial<ExtensionContribution> = {},
): ExtensionContribution {
  return {
    id: `demo.${kind}.${id}`,
    extension_id: "demo",
    kind,
    label: `Item ${id}`,
    entry: kind === "file_icon" ? null : `${id}.html`,
    ...extra,
  };
}

beforeEach(() => {
  useExtensionsStore.setState({
    contributions: [],
    activeModeId: null,
    activeViewId: null,
    loaded: false,
  });
});

describe("modos contribuídos", () => {
  it("não renderiza nada sem extensões", () => {
    const { container } = render(<ExtensionModeButtons />);
    expect(container).toBeEmptyDOMElement();
  });

  it("o botão abre e fecha a superfície do modo", () => {
    act(() =>
      useExtensionsStore.getState().setContributions([make("mode", "studio")]),
    );
    render(
      <>
        <ExtensionModeButtons />
        <ExtensionModeSurface />
      </>,
    );
    expect(screen.queryByTestId("extension-mode-surface")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Item studio/ }));
    expect(screen.getByTestId("extension-mode-surface")).toBeInTheDocument();
    expect(document.querySelector("iframe")).toHaveAttribute(
      "src",
      "/extensions/demo/ui/studio.html",
    );

    fireEvent.click(screen.getByRole("button", { name: /Item studio/ }));
    expect(screen.queryByTestId("extension-mode-surface")).toBeNull();
  });

  it("extensão removida fecha o modo que estava aberto", () => {
    act(() => {
      useExtensionsStore.getState().setContributions([make("mode", "studio")]);
      useExtensionsStore.getState().setActiveMode("demo.mode.studio");
      useExtensionsStore.getState().setContributions([]);
    });

    expect(useExtensionsStore.getState().activeModeId).toBeNull();
  });
});

describe("ações de header", () => {
  it("cada ação abre a página da extensão num diálogo", async () => {
    act(() =>
      useExtensionsStore
        .getState()
        .setContributions([
          make("header_action", "painel", { icon: "rocket" }),
        ]),
    );
    render(<ExtensionHeaderActions />);

    fireEvent.click(screen.getByRole("button", { name: "Item painel" }));

    await screen.findByRole("dialog");
    expect(document.querySelector("iframe")).toHaveAttribute(
      "src",
      "/extensions/demo/ui/painel.html",
    );
  });
});

describe("páginas de Configurações", () => {
  it("entram num grupo próprio, com id ext:", () => {
    const page = make("settings_page", "config");

    const groups = buildSettingsCategoryGroups({
      connectEnabled: false,
      isAdmin: false,
      extensionPages: [page],
    });

    const group = groups.find((entry) => entry.id === "extensoes");
    expect(group?.categories.map((category) => category.id)).toEqual([
      "ext:demo.settings_page.config",
    ]);
  });

  it("sem páginas não cria o grupo", () => {
    const groups = buildSettingsCategoryGroups({
      connectEnabled: false,
      isAdmin: false,
    });

    expect(groups.some((entry) => entry.id === "extensoes")).toBe(false);
  });
});

describe("ícones de arquivo", () => {
  it("usa o ícone contribuído para a extensão do arquivo", () => {
    act(() =>
      useExtensionsStore
        .getState()
        .setContributions([
          make("file_icon", "docs", { icon: "file", file_extensions: ["foo"] }),
        ]),
    );

    const { container } = render(<FileIcon name="nota.foo" className="x" />);

    expect(container.querySelector("svg.x")).not.toBeNull();
  });
});
