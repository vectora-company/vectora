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

describe("buildSettingsCategoryGroups — Administração achatada", () => {
  it("usuário admin vê Acesso às ferramentas e as quatro categorias de admin", () => {
    const ids = adminCategoryIds();
    expect(ids).toEqual([
      "tool_policy",
      "admin_users",
      "admin_saferoots",
      "admin_system",
      "admin_storage",
    ]);
  });

  it("admin Free mantém gerenciamento local de usuários", () => {
    expect(adminCategoryIds()).toContain("admin_users");
  });

  it("sem role admin/root, Administração só tem o Acesso às ferramentas", () => {
    const groups = buildSettingsCategoryGroups({
      connectEnabled: false,
      isAdmin: false,
    });
    const admin = groups.find((g) => g.id === "administracao");
    expect(admin?.categories.map((c) => c.id)).toEqual(["tool_policy"]);
  });

  it("Acesso às ferramentas deixou o grupo Ambiente e o id antigo de Ferramentas leva a ele", () => {
    const groups = buildSettingsCategoryGroups({
      connectEnabled: false,
      isAdmin: true,
    });
    const ambiente = groups.find((g) => g.id === "ambiente");
    expect(ambiente?.categories.map((c) => c.id)).not.toContain("tool_policy");
    expect(findCategory(groups, "admin_tools")?.id).toBe("tool_policy");
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
