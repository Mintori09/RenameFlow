import { create } from "zustand";
import type { FileItem, RenameSuggestion, FileStatus } from "../types";

type GenerateStatus = "idle" | "generating" | "ready" | "error";

type FileStore = {
  files: FileItem[];
  suggestions: Record<string, RenameSuggestion>;
  selectedIds: Set<string>;
  generateStatus: GenerateStatus;
  errorMessage: string | null;
  addFiles: (paths: string[]) => void;
  removeFile: (id: string) => void;
  clearAll: () => void;
  updateSuggestion: (fileId: string, newName: string) => void;
  setSuggestions: (suggestions: RenameSuggestion[]) => void;
  toggleFile: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  setGenerateStatus: (status: GenerateStatus) => void;
  setErrorMessage: (msg: string | null) => void;
  updateFileStatus: (id: string, status: FileStatus, error?: string) => void;
};

export const useFileStore = create<FileStore>((set) => ({
  files: [],
  suggestions: {},
  selectedIds: new Set(),
  generateStatus: "idle",
  errorMessage: null,
  addFiles: (paths) =>
    set((state) => {
      const newFiles: FileItem[] = paths.map((p) => {
        const parts = p.replace(/\\/g, "/").split("/");
        const fullName = parts[parts.length - 1] || "";
        const dot = fullName.lastIndexOf(".");
        const ext = dot >= 0 ? fullName.slice(dot) : "";
        const name = dot >= 0 ? fullName.slice(0, dot) : fullName;
        return {
          id: crypto.randomUUID(),
          path: p,
          directory: parts.slice(0, -1).join("/"),
          originalName: name,
          extension: ext,
          size: 0,
          status: "pending" as FileStatus,
        };
      });
      return { files: [...state.files, ...newFiles] };
    }),
  removeFile: (id) =>
    set((state) => ({
      files: state.files.filter((f) => f.id !== id),
      selectedIds: new Set([...state.selectedIds].filter((sid) => sid !== id)),
    })),
  clearAll: () =>
    set({ files: [], suggestions: {}, selectedIds: new Set(), generateStatus: "idle", errorMessage: null }),
  updateSuggestion: (fileId, newName) =>
    set((state) => {
      const s = state.suggestions[fileId];
      if (!s) return state;
      return { suggestions: { ...state.suggestions, [fileId]: { ...s, finalName: newName } } };
    }),
  setSuggestions: (suggestions) =>
    set(() => {
      const map: Record<string, RenameSuggestion> = {};
      const selectedIds = new Set<string>();
      for (const s of suggestions) { map[s.fileId] = s; selectedIds.add(s.fileId); }
      return { suggestions: map, selectedIds, generateStatus: "ready" };
    }),
  toggleFile: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { selectedIds: next };
    }),
  selectAll: () =>
    set((state) => ({ selectedIds: new Set(state.files.map((f) => f.id)) })),
  deselectAll: () => set({ selectedIds: new Set() }),
  setGenerateStatus: (status) => set({ generateStatus: status }),
  setErrorMessage: (msg) => set({ errorMessage: msg }),
  updateFileStatus: (id, status, error) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? { ...f, status, error } : f)),
    })),
}));
