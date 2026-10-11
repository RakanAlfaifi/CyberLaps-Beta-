import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getBrowserStorage, storageKey } from "@/core/persistence/storage";
import type { LedgerAsset, LedgerAssetInput, LedgerPort } from "@/types/ledger";
import { useProgressStore } from "./progressStore";

interface LedgerState {
  /** Keyed by IP. Kept across levels: later levels build on earlier finds. */
  assets: Record<string, LedgerAsset>;

  upsertAsset: (input: LedgerAssetInput) => void;
  addPorts: (ip: string, ports: LedgerPort[]) => void;
  removeAsset: (ip: string) => void;
  /** Drops every device first found in that level. */
  removeAssetsFoundIn: (levelId: number) => void;
  clearLedger: () => void;
}

const portKey = (p: LedgerPort) => `${p.protocol}/${p.port}`;

function mergePorts(existing: LedgerPort[], incoming: LedgerPort[]): LedgerPort[] {
  const byKey = new Map(existing.map((p) => [portKey(p), p]));
  for (const port of incoming) {
    const previous = byKey.get(portKey(port));
    byKey.set(portKey(port), { ...previous, ...withoutUndefined(port) } as LedgerPort);
  }
  return [...byKey.values()].sort((a, b) => a.port - b.port || a.protocol.localeCompare(b.protocol));
}

function withoutUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export const useLedgerStore = create<LedgerState>()(
  persist(
    (set, get) => ({
      assets: {},

      upsertAsset: (input) =>
        set((state) => {
          const now = Date.now();
          const { ports = [], ...fields } = input;
          const known = withoutUndefined(fields);
          const existing = state.assets[input.ip];

          const next: LedgerAsset = existing
            ? {
                ...existing,
                ...known,
                discoveredInLevel: existing.discoveredInLevel,
                ports: mergePorts(existing.ports, ports),
                lastSeen: now,
              }
            : {
                discoveredInLevel: useProgressStore.getState().currentLevelId,
                ...known,
                ip: input.ip,
                ports: mergePorts([], ports),
                firstSeen: now,
                lastSeen: now,
              };

          return { assets: { ...state.assets, [input.ip]: next } };
        }),

      addPorts: (ip, ports) => get().upsertAsset({ ip, ports }),

      removeAsset: (ip) =>
        set((state) => {
          const assets = { ...state.assets };
          delete assets[ip];
          return { assets };
        }),

      removeAssetsFoundIn: (levelId) =>
        set((state) => {
          const kept = Object.entries(state.assets).filter(([, asset]) => asset.discoveredInLevel !== levelId);
          return kept.length === Object.keys(state.assets).length ? state : { assets: Object.fromEntries(kept) };
        }),

      clearLedger: () => set({ assets: {} }),
    }),
    {
      name: storageKey("ledger"),
      version: 1,
      storage: createJSONStorage(getBrowserStorage),
      partialize: (s) => ({ assets: s.assets }),
    },
  ),
);
