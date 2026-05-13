import { create } from "zustand";
import type { RenameHistory } from "../types";

type HistoryStore = {
  entries: RenameHistory[];
  setEntries: (entries: RenameHistory[]) => void;
  addEntry: (entry: RenameHistory) => void;
};

export const useHistoryStore = create<HistoryStore>((set) => ({
  entries: [],
  setEntries: (entries) => set({ entries }),
  addEntry: (entry) => set((s) => ({ entries: [entry, ...s.entries] })),
}));
