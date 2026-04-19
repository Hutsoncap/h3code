// FILE: sidebarSectionsStore.ts
// Purpose: Persist sidebar section collapse state ahead of pinned/browser section work.
// Layer: Sidebar UI state

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createAliasedStateStorage } from "./lib/storage";
import {
  decodePersistedStateOrNull,
  PersistedSidebarSectionsStateSchema,
} from "./persistenceSchema";

export type SidebarSectionKey = "pinned" | "threads" | "workspaces" | "browser";

export interface SidebarSectionsState {
  pinned: boolean;
  threads: boolean;
  workspaces: boolean;
  browser: boolean;
}

interface SidebarSectionsStoreState {
  sections: SidebarSectionsState;
  setSectionOpen: (section: SidebarSectionKey, open: boolean) => void;
  toggleSection: (section: SidebarSectionKey) => void;
}

const SIDEBAR_SECTIONS_STORAGE_KEY = "h3code:sidebar-sections:v1";

const DEFAULT_SIDEBAR_SECTIONS_STATE: SidebarSectionsState = {
  pinned: true,
  threads: true,
  workspaces: true,
  browser: true,
};

function cloneDefaultSidebarSectionsState(): SidebarSectionsState {
  return { ...DEFAULT_SIDEBAR_SECTIONS_STATE };
}

function normalizePersistedSidebarSectionsState(persistedState: unknown): SidebarSectionsState {
  const decoded =
    decodePersistedStateOrNull(PersistedSidebarSectionsStateSchema, persistedState)?.sections ??
    null;
  if (!decoded) {
    return cloneDefaultSidebarSectionsState();
  }

  return {
    pinned: decoded.pinned,
    threads: decoded.threads,
    workspaces: decoded.workspaces,
    browser: decoded.browser,
  };
}

export const useSidebarSectionsStore = create<SidebarSectionsStoreState>()(
  persist(
    (set) => ({
      sections: cloneDefaultSidebarSectionsState(),
      setSectionOpen: (section, open) =>
        set((state) => {
          if (state.sections[section] === open) {
            return state;
          }

          return {
            sections: {
              ...state.sections,
              [section]: open,
            },
          };
        }),
      toggleSection: (section) =>
        set((state) => ({
          sections: {
            ...state.sections,
            [section]: !state.sections[section],
          },
        })),
    }),
    {
      name: SIDEBAR_SECTIONS_STORAGE_KEY,
      storage: createJSONStorage(() => createAliasedStateStorage(localStorage)),
      partialize: (state) => ({
        sections: state.sections,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        sections: normalizePersistedSidebarSectionsState(persistedState),
      }),
    },
  ),
);
