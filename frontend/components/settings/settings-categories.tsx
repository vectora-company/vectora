"use client";

/**
 * Registro das categorias do `SettingsOverlay` — remapeamento 1:1 das
 * ~12 abas que hoje vivem espalhadas em 3 diálogos Radix independentes,
 * mais Plugins/Skills/Tool Policy (componentes prontos, mas nunca
 * renderizados por nenhum dos 3 diálogos até agora) e Billing/About
 * (conteúdo real relocado, não placeholder — CLAUDE.md §9).
 *
 * Cada categoria aponta pro MESMO componente de conteúdo que já existia
 * — o remapeamento troca só a casca (onde a categoria aparece e como se
 * navega até ela), nunca reescreve a lógica de negócio de dentro.
 */

import type { ComponentType } from "react";

import { lazyWithRetry } from "@/lib/lazy-with-retry";
import { m } from "@/lib/paraglide/messages";
import type { SettingsCategoryId } from "@/lib/stores/settings-overlay-store";

const GeralTab = lazyWithRetry(
  () =>
    import("./preferencias/tabs/preferencias-tab").then((mod) => ({
      default: mod.PreferenciasTab,
    })),
  "settings-geral-tab",
);
const ContaTab = lazyWithRetry(
  () =>
    import("./preferencias/tabs/conta-tab").then((mod) => ({
      default: mod.ContaTab,
    })),
  "settings-conta-tab",
);
const IntegracoesTab = lazyWithRetry(
  () =>
    import("./environment/tabs/integracoes-tab").then((mod) => ({
      default: mod.IntegracoesSettingsTab,
    })),
  "settings-integracoes-tab",
);
const MediaSettingsTab = lazyWithRetry(
  () =>
    import("./environment/tabs/media-settings-tab").then((mod) => ({
      default: mod.MediaSettingsTab,
    })),
  "settings-media-tab",
);
const ProviderRoutingTab = lazyWithRetry(
  () =>
    import("./environment/tabs/provider-routing-tab").then((mod) => ({
      default: mod.ProviderRoutingTab,
    })),
  "settings-provider-routing-tab",
);
const AiModelsTab = lazyWithRetry(
  () =>
    import("./environment/tabs/ai-models-tab").then((mod) => ({
      default: mod.AiModelsTab,
    })),
  "settings-ai-models-tab",
);
const ConnectTab = lazyWithRetry(
  () =>
    import("./environment/tabs/connect-tab").then((mod) => ({
      default: mod.ConnectTab,
    })),
  "settings-connect-tab",
);
const PluginsTab = lazyWithRetry(
  () =>
    import("./environment/tabs/plugins-tab").then((mod) => ({
      default: mod.PluginsTab,
    })),
  "settings-plugins-tab",
);
const SkillsTab = lazyWithRetry(
  () =>
    import("./environment/tabs/skills-tab").then((mod) => {
      // `SkillsTab` só aceita `onSkillsChange` opcional, mas TS não permite
      // atribuir a `ComponentType<unknown>` (contravariância estrita) — o
      // wrapper só existe pra satisfazer o tipo, roda uma vez por load.
      // oxlint-disable-next-line unicorn/consistent-function-scoping
      const Wrapped = () => <mod.SkillsTab />;
      return { default: Wrapped };
    }),
  "settings-skills-tab",
);
const ToolPolicyPanel = lazyWithRetry(
  () =>
    import("./environment/tabs/tool-policy-panel").then((mod) => ({
      default: mod.ToolPolicyPanel,
    })),
  "settings-tool-policy-tab",
);
const SandboxTab = lazyWithRetry(
  () =>
    import("./environment/tabs/sandbox-tab").then((mod) => ({
      default: mod.SandboxTab,
    })),
  "settings-sandbox-tab",
);
const WorkbenchesSettings = lazyWithRetry(
  () =>
    import("../workbench/settings/workbenches-settings-category").then(
      (mod) => ({
        default: mod.WorkbenchesSettings,
      }),
    ),
  "settings-workbenches",
);
const HitlAllowlistPanel = lazyWithRetry(
  () =>
    import("./environment/tabs/hitl-allowlist-panel").then((mod) => ({
      default: mod.HitlAllowlistPanel,
    })),
  "settings-hitl-allowlist-tab",
);
const UsersPanel = lazyWithRetry(
  () =>
    import("./administracao/admin-tab").then((mod) => ({
      default: mod.UsersPanel,
    })),
  "settings-admin-users",
);
const SafeRootsPanel = lazyWithRetry(
  () =>
    import("./administracao/admin-tab").then((mod) => ({
      default: mod.SafeRootsPanel,
    })),
  "settings-admin-saferoots",
);
const SystemPanel = lazyWithRetry(
  () =>
    import("./administracao/admin-tab").then((mod) => ({
      default: mod.SystemPanel,
    })),
  "settings-admin-system",
);
const StoragePanel = lazyWithRetry(
  () =>
    import("./administracao/admin-tab").then((mod) => ({
      default: mod.StoragePanel,
    })),
  "settings-admin-storage",
);
export type SettingsGroupId = "preferencias" | "ambiente" | "administracao";

export interface SettingsCategory {
  id: SettingsCategoryId;
  group: SettingsGroupId;
  label: string;
  Component: ComponentType<Record<string, never>>;
}

export interface SettingsCategoryGroup {
  id: SettingsGroupId;
  label: string;
  categories: SettingsCategory[];
}

interface BuildCategoriesArgs {
  connectEnabled: boolean;
  isAdmin: boolean;
}

/** Monta as categorias visíveis, respeitando feature flag (Connect) e role. */
export function buildSettingsCategoryGroups({
  connectEnabled,
  isAdmin,
}: BuildCategoriesArgs): SettingsCategoryGroup[] {
  const preferencias: SettingsCategory[] = [
    {
      id: "geral",
      group: "preferencias",
      label: m.settings_category_geral(),
      Component: GeralTab,
    },
    {
      id: "conta",
      group: "preferencias",
      label: m.settings_category_conta(),
      Component: ContaTab,
    },
  ];

  const ambiente: SettingsCategory[] = [
    {
      id: "integracoes",
      group: "ambiente",
      label: m.settings_category_integracoes(),
      Component: IntegracoesTab,
    },
    {
      id: "ai_models",
      group: "ambiente",
      label: m.settings_category_ai_models(),
      Component: AiModelsTab,
    },
    {
      id: "provider_routing",
      group: "ambiente",
      label: m.settings_category_provider_routing(),
      Component: ProviderRoutingTab,
    },
    {
      id: "media",
      group: "ambiente",
      label: m.settings_category_media(),
      Component: MediaSettingsTab,
    },
    ...(connectEnabled
      ? ([
          {
            id: "connect",
            group: "ambiente",
            label: m.settings_category_connect(),
            Component: ConnectTab,
          },
        ] as SettingsCategory[])
      : []),
    {
      id: "plugins",
      group: "ambiente",
      label: m.settings_category_plugins(),
      Component: PluginsTab,
    },
    {
      id: "skills",
      group: "ambiente",
      label: m.settings_category_skills(),
      Component: SkillsTab,
    },
    {
      id: "hitl_allowlist",
      group: "ambiente",
      label: m.settings_category_hitl_allowlist(),
      Component: HitlAllowlistPanel,
    },
    {
      id: "sandbox",
      group: "ambiente",
      label: m.settings_category_sandbox(),
      Component: SandboxTab,
    },
    {
      id: "workbenches",
      group: "ambiente",
      label: m.settings_category_workbenches(),
      Component: WorkbenchesSettings,
    },
  ];

  // Acesso às ferramentas é de todos: o admin define quem usa o quê, e os
  // demais só podem remover o próprio acesso. O resto da Administração é só
  // para admin.
  const administracao: SettingsCategory[] = [
    {
      id: "tool_policy",
      group: "administracao",
      label: m.settings_category_tool_policy(),
      Component: ToolPolicyPanel,
    },
    ...(isAdmin
      ? ([
          {
            id: "admin_users",
            group: "administracao",
            label: m.admin_tab_users(),
            Component: UsersPanel,
          },
          {
            id: "admin_saferoots",
            group: "administracao",
            label: m.admin_tab_saferoots(),
            Component: SafeRootsPanel,
          },
          {
            id: "admin_system",
            group: "administracao",
            label: m.admin_tab_system(),
            Component: SystemPanel,
          },
          {
            id: "admin_storage",
            group: "administracao",
            label: m.admin_tab_storage(),
            Component: StoragePanel,
          },
        ] as SettingsCategory[])
      : []),
  ];

  const groups: SettingsCategoryGroup[] = [
    {
      id: "preferencias",
      label: m.settings_group_preferencias(),
      categories: preferencias,
    },
    {
      id: "ambiente",
      label: m.settings_group_environment(),
      categories: ambiente,
    },
  ];
  if (administracao.length > 0) {
    groups.push({
      id: "administracao",
      label: m.settings_group_admin(),
      categories: administracao,
    });
  }

  return groups;
}

/** Cobrança e Sobre agora são seções da aba Conta, Git faz parte de
 * Workbenches e as memórias vivem no workbench de Memória: os ids antigos
 * ficam como alias para não quebrar deep-links que ainda abrem
 * `openCategory("billing")`, `("about")`, `("git")` ou `("memoria")`; a
 * antiga "Ferramentas" da Administração agora é o Acesso às ferramentas. */
const CATEGORY_ALIASES: Partial<
  Record<SettingsCategoryId, SettingsCategoryId>
> = {
  about: "conta",
  memoria: "geral",
  billing: "conta",
  git: "workbenches",
  admin_tools: "tool_policy",
};

export function findCategory(
  groups: SettingsCategoryGroup[],
  id: SettingsCategoryId,
): SettingsCategory | undefined {
  const resolvedId = CATEGORY_ALIASES[id] ?? id;
  for (const group of groups) {
    const found = group.categories.find((c) => c.id === resolvedId);
    if (found) return found;
  }
  return undefined;
}

/** Fallback pra quando `activeCategory` persistido/pedido não existe mais
 * na lista visível (ex.: usuário perdeu role admin) — nunca renderiza tela
 * em branco. */
export function firstAvailableCategory(
  groups: SettingsCategoryGroup[],
): SettingsCategoryId {
  for (const group of groups) {
    if (group.categories[0]) return group.categories[0].id;
  }
  return "geral";
}
