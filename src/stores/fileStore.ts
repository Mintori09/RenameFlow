import { create } from "zustand";
import type { FileItem, FileStatus, RenameSuggestion } from "../types";

type GenerateStatus = "idle" | "generating" | "ready" | "error";

type FileStore = {
  files: FileItem[];
  suggestions: Record<string, RenameSuggestion>;
  selectedIds: Set<string>;
  generateStatus: GenerateStatus;
  errorMessage: string | null;
  dropSourcePaths: string[];
  setDropSourcePaths: (paths: string[]) => void;
  addFiles: (paths: string[]) => void;
  removeFile: (id: string) => void;
  removeFilesByPaths: (paths: string[]) => void;
  clearAll: () => void;
  updateSuggestion: (fileId: string, newName: string) => void;
  addSuggestion: (suggestion: RenameSuggestion) => void;
  setSuggestions: (suggestions: RenameSuggestion[]) => void;
  toggleFile: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  setGenerateStatus: (status: GenerateStatus) => void;
  setErrorMessage: (msg: string | null) => void;
  updateFileStatus: (id: string, status: FileStatus, error?: string) =>
    void;
  updateFileName: (id: string, path: string, originalName: string, extension: string) =>
    void;
  setOldPath: (id: string, oldPath?: string) => void;
};
export const useFileStore = create<FileStore>((set) => ({
  files: [],
  suggestions: {},
  selectedIds: new Set(),
  generateStatus: "idle",
  errorMessage: null,
  dropSourcePaths: [],
  setDropSourcePaths: (paths) => set({ dropSourcePaths: paths }),
  addFiles: (paths) =>
    set((state) => {
      const existing = new Set(state.files.map((f) => f.path));
      const uniquePaths = paths.filter((p) => !existing.has(p));
      const newFiles: FileItem[] = uniquePaths.map((p) => {
        const parts = p.replace(/\\/g, "/").split("/");
        const fullName = parts[parts.length - 1] || "";
        const isDotfile = fullName.startsWith(".") && fullName.lastIndexOf(".") === 0;
        const dot = isDotfile ? -1 : fullName.lastIndexOf(".");
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
    set((state) => {
      const newSuggestions = { ...state.suggestions };
      delete newSuggestions[id];
      return {
        files: state.files.filter((f) => f.id !== id),
        selectedIds: new Set(
          [...state.selectedIds].filter((sid) => sid !== id),
        ),
        suggestions: newSuggestions,
      };
    }),
  removeFilesByPaths: (paths: string[]) =>
    set((state) => {
      const pathSet = new Set(paths);
      const removedIds = new Set(
        state.files.filter((f) => pathSet.has(f.path)).map((f) => f.id),
      );
      const newSuggestions = { ...state.suggestions };
      for (const id of removedIds) {
        delete newSuggestions[id];
      }
      return {
        files: state.files.filter((f) => !pathSet.has(f.path)),
        selectedIds: new Set(
          [...state.selectedIds].filter((id) => !removedIds.has(id)),
        ),
        suggestions: newSuggestions,
      };
    }),
  clearAll: () =>
    set({
      files: [],
      suggestions: {},
      selectedIds: new Set(),
      generateStatus: "idle",
      errorMessage: null,
      dropSourcePaths: [],
    }),
  updateSuggestion: (fileId, newName) =>
    set((state) => {
      const s = state.suggestions[fileId];
      if (!s) return state;
      return {
        suggestions: {
          ...state.suggestions,
          [fileId]: { ...s, finalName: newName },
        },
      };
    }),
  addSuggestion: (suggestion) =>
    set((state) => ({
      suggestions: { ...state.suggestions, [suggestion.fileId]: suggestion },
      selectedIds: new Set([...state.selectedIds, suggestion.fileId]),
    })),
  setSuggestions: (suggestions) =>
    set(() => {
      const map: Record<string, RenameSuggestion> = {};
      const selectedIds = new Set<string>();
      for (const s of suggestions) {
        map[s.fileId] = s;
        selectedIds.add(s.fileId);
      }
      return { suggestions: map, selectedIds, generateStatus: "ready" };
    }),
  toggleFile: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),
  selectAll: () =>
    set((state) => ({ selectedIds: new Set(state.files.map((f) => f.id)) })),
  deselectAll: () => set({ selectedIds: new Set() }),
  setGenerateStatus: (status) => set({ generateStatus: status }),
  setErrorMessage: (msg) => set({ errorMessage: msg }),
  updateFileStatus: (id, status, error) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id ? { ...f, status, error } : f,
      ),
    })),
  updateFileName: (id, path, originalName, extension) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id ? { ...f, path, originalName, extension } : f,
      ),
    })),
  setOldPath: (id, oldPath) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id ? { ...f, oldPath } : f,
      ),
    })),
}));
