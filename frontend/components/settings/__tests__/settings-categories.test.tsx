// @vitest-environment jsdom
/**
 * buildSettingsCategoryGroups, findCategory — gating de role (Administração) e feature flag
 * (Connect).
 */

import { describe, expect, it, vi } from "vitest";

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

import {
  buildSettingsCategoryGroups,
  findCategory,
} from "../settings-categories";

function adminCategoryIds() {
  const groups = buildSettingsCategoryGroups({
    connectEnabled: false,
    isAdmin: true,
  });
  const admin = groups.find((g) => g.id === "administracao");
  return admin?.categories.map((c) => c.id) ?? [];
}

describe("buildSettingsCategoryGroups — Administração achatada (5 categorias, não 1)", () => {
  it("usuário admin vê as 5 categorias, cada uma no rail", () => {
    const ids = adminCategoryIds();
    expect(ids).toEqual([
      "admin_users",
      "admin_tools",
      "admin_saferoots",
      "admin_system",
      "admin_storage",
    ]);
  });

  it("usuário admin Free mantém gerenciamento local de usuários", () => {
    const ids = adminCategoryIds();
    expect(ids).toEqual([
      "admin_users",
      "admin_tools",
      "admin_saferoots",
      "admin_system",
      "admin_storage",
    ]);
    expect(ids).toContain("admin_users");
  });

  it("erro/borda: sem role admin/root, nenhuma categoria de Administração aparece", () => {
    const groups = buildSettingsCategoryGroups({
      connectEnabled: false,
      isAdmin: false,
    });
    expect(groups.find((g) => g.id === "administracao")).toBeUndefined();
  });

  it("Mídia vem depois do Provider Routing, dentro do grupo Ambiente", () => {
    const groups = buildSettingsCategoryGroups({
      connectEnabled: true,
      isAdmin: false,
    });
    const ids = groups
      .find((g) => g.id === "ambiente")
      ?.categories.map((c) => c.id);

    expect(ids).toBeDefined();
    const order = ["ai_models", "provider_routing", "media", "connect"];
    expect(ids?.filter((id) => order.includes(id))).toEqual(order);
  });

  it("Cobrança deixou de ser uma categoria e os ids antigos levam à Conta", () => {
    const groups = buildSettingsCategoryGroups({
      connectEnabled: false,
      isAdmin: true,
    });
    const ids = groups.flatMap((g) => g.categories.map((c) => c.id));

    expect(ids).not.toContain("billing");
    expect(groups.map((g) => g.id)).not.toContain("geral_grupo");
    expect(findCategory(groups, "billing")?.id).toBe("conta");
    expect(findCategory(groups, "about")?.id).toBe("conta");
  });

  it("Memória não é mais uma categoria: vive no workbench e o id antigo abre Geral", () => {
    const groups = buildSettingsCategoryGroups({
      connectEnabled: false,
      isAdmin: true,
    });
    const ids = groups.flatMap((g) => g.categories.map((c) => c.id));

    expect(ids).not.toContain("memoria");
    expect(findCategory(groups, "memoria")?.id).toBe("geral");
  });
});
