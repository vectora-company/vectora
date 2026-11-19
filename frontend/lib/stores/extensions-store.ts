import { create } from "zustand";
import {
  type ExtensionContribution,
  resolveContributions,
} from "@/lib/extensions/registry";

interface ExtensionsState {
  contributions: ExtensionContribution[];
  /** Id da contribuição de modo aberta no centro da tela, se houver. */
  activeModeId: string | null;
  /** Id da view de Workbench contribuída que está aberta, se houver. */
  activeViewId: string | null;
  loaded: boolean;
  load: () => Promise<void>;
  setContributions: (items: ExtensionContribution[]) => void;
  setActiveMode: (id: string | null) => void;
  setActiveView: (id: string | null) => void;
}

/** Contribuições das extensões ativas, resolvidas e sem conflito de id. */
export const useExtensionsStore = create<ExtensionsState>((set, get) => ({
  contributions: [],
  activeModeId: null,
  activeViewId: null,
  loaded: false,
  setContributions: (items) => {
    const { accepted } = resolveContributions(items);
    const stillThere = (id: string | null) =>
      id && accepted.some((item) => item.id === id) ? id : null;
    set({
      contributions: accepted,
      loaded: true,
      activeModeId: stillThere(get().activeModeId),
      activeViewId: stillThere(get().activeViewId),
    });
  },
  setActiveMode: (id) => set({ activeModeId: id }),
  setActiveView: (id) => set({ activeViewId: id }),
  load: async () => {
    try {
      const res = await fetch("/extensions/contributions", {
        credentials: "include",
      });
      if (!res.ok) {
        // Sem extensões a interface segue só com o que é nativo.
        get().setContributions([]);
        return;
      }
      get().setContributions((await res.json()) as ExtensionContribution[]);
    } catch {
      get().setContributions([]);
    }
  },
}));
