import { create } from "zustand";
import {
  generateRenameSuggestions,
  renameFiles as executeRename,
  undoLastRename,
} from "../services/renameService";
import { loadRenameHistory } from "../services/historyService";
import { useFileStore } from "./fileStore";
import { useSettingsStore } from "./settingsStore";
import { useHistoryStore } from "./historyStore";

type GenerateStatus = "idle" | "generating" | "ready" | "error";

let genId = 0;

type WorkflowState = {
  generateStatus: GenerateStatus;
  renaming: boolean;
  regeneratingIds: Set<string>;
  errorMessage: string | null;
  setGenerateStatus: (status: GenerateStatus) => void;
  setErrorMessage: (msg: string | null) => void;
  generateAllSuggestions: () => Promise<void>;
  regenerateSuggestion: (fileId: string) => Promise<void>;
  renameSelectedFiles: () => Promise<{ success: number; failed: number }>;
  cancelAllOperations: () => void;
  loadHistory: () => Promise<void>;
  undoLastRename: () => Promise<void>;
};

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  generateStatus: "idle",
  renaming: false,
  regeneratingIds: new Set(),
  errorMessage: null,

  setGenerateStatus: (status) => set({ generateStatus: status }),
  setErrorMessage: (msg) => set({ errorMessage: msg }),

  generateAllSuggestions: async () => {
    const currentGenId = ++genId;
    const fileStore = useFileStore.getState();
    const files = fileStore.files;
    const settings = useSettingsStore.getState();
    if (files.length === 0) return;

    fileStore.setGenerateStatus("generating");
    fileStore.setErrorMessage(null);
    set({ generateStatus: "generating", errorMessage: null });

    try {
      const result = await generateRenameSuggestions({
        files: files.map((f) => ({ id: f.id, path: f.path })),
        provider: settings.provider,
        model: settings.model,
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        prompt: settings.prompt,
        options: {
          style: settings.style,
          max_words: settings.maxWords,
          language: settings.language,
        },
      });
      if (genId !== currentGenId) return;
      useFileStore.getState().setSuggestions(result);
    } catch (err) {
      if (genId !== currentGenId) return;
      const msg = String(err);
      fileStore.setErrorMessage(msg);
      fileStore.setGenerateStatus("error");
      set({ errorMessage: msg, generateStatus: "error" });
    }
  },

  regenerateSuggestion: async (fileId: string) => {
    const currentGenId = ++genId;
    const file = useFileStore.getState().files.find((f) => f.id === fileId);
    if (!file) return;

    set((state) => ({
      regeneratingIds: new Set(state.regeneratingIds).add(fileId),
    }));
    set({ errorMessage: null });
    useFileStore.getState().setErrorMessage(null);

    try {
      const settings = useSettingsStore.getState();
      const result = await generateRenameSuggestions({
        files: [{ id: file.id, path: file.path }],
        provider: settings.provider,
        model: settings.model,
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        prompt: settings.prompt,
        options: {
          style: settings.style,
          max_words: settings.maxWords,
          language: settings.language,
        },
      });
      if (genId !== currentGenId) return;
      if (result.length > 0) {
        const store = useFileStore.getState();
        store.setSuggestions([
          ...Object.values(store.suggestions).filter(
            (s) => s.fileId !== fileId,
          ),
          result[0],
        ]);
      }
    } catch (err) {
      if (genId !== currentGenId) return;
      const msg = String(err);
      set({ errorMessage: msg });
      useFileStore.getState().setErrorMessage(msg);
    } finally {
      set((state) => {
        const next = new Set(state.regeneratingIds);
        next.delete(fileId);
        return { regeneratingIds: next };
      });
    }
  },

  renameSelectedFiles: async () => {
    const currentGenId = ++genId;
    const store = useFileStore.getState();
    const ops: Array<{
      fileId: string;
      fromPath: string;
      toPath: string;
      originalName: string;
      newName: string;
    }> = [];

    let skippedCount = 0;
    for (const fileId of store.selectedIds) {
      const file = store.files.find((f) => f.id === fileId);
      const s = store.suggestions[fileId];
      if (!file) { skippedCount++; continue; }
      if (!s) { skippedCount++; continue; }

      let finalName = s.finalName;
      if (file.extension && !finalName.endsWith(file.extension)) {
        finalName = finalName + file.extension;
      }

      const newPath = file.directory
        ? `${file.directory}/${finalName}`
        : finalName;
      ops.push({
        fileId: file.id,
        fromPath: file.path,
        toPath: newPath,
        originalName: file.originalName,
        newName: finalName,
      });
    }
    if (skippedCount > 0) {
      console.warn(`[renameflow] Skipped ${skippedCount} selected file(s) — missing file or suggestion data`);
    }

    if (ops.length === 0) return { success: 0, failed: 0 };

    set({ renaming: true, errorMessage: null });
    try {
      const result = await executeRename(ops);
      if (genId !== currentGenId) return { success: 0, failed: 0 };
      const fileStore = useFileStore.getState();
      for (const op of result.success) {
        fileStore.removeFile(op.fileId);
      }
      for (const op of result.failed) {
        fileStore.updateFileStatus(op.operation.fileId, "failed", op.error);
      }
      const remaining = useFileStore.getState();
      if (Object.keys(remaining.suggestions).length === 0) {
        remaining.setGenerateStatus("idle");
        set({ generateStatus: "idle" });
      }
      get().loadHistory();
      return { success: result.success.length, failed: result.failed.length };
    } catch (err) {
      const msg = String(err);
      set({ errorMessage: msg, generateStatus: "error" });
      useFileStore.getState().setErrorMessage(msg);
      useFileStore.getState().setGenerateStatus("error");
      return { success: 0, failed: ops.length };
    } finally {
      set({ renaming: false });
    }
  },

  cancelAllOperations: () => {
    genId++;
    set({
      generateStatus: "idle",
      renaming: false,
      regeneratingIds: new Set(),
      errorMessage: null,
    });
    useFileStore.setState({
      suggestions: {},
      selectedIds: new Set(),
      generateStatus: "idle",
      errorMessage: null,
    });
  },

  loadHistory: async () => {
    try {
      const history = await loadRenameHistory();
      useHistoryStore.getState().setEntries(history);
    } catch {}
  },

  undoLastRename: async () => {
    try {
      await undoLastRename();
      get().loadHistory();
    } catch (err) {
      const msg = String(err);
      set({ errorMessage: msg });
      useFileStore.getState().setErrorMessage(msg);
    }
  },
}));
