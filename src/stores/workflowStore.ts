import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import {
  generateRenameSuggestions,
  renameFiles as executeRename,
  undoFileRename,
  undoLastRename,
  cancelGeneration,
} from "../services/renameService";
import { loadRenameHistory } from "../services/historyService";
import { useFileStore } from "./fileStore";
import { useSettingsStore } from "./settingsStore";
import { useHistoryStore } from "./historyStore";
import type { RenameSuggestion } from "../types";

type GenerateStatus = "idle" | "generating" | "ready" | "error";

let genId = 0;

function splitFileName(fullName: string): [string, string] {
  const isDotfile = fullName.startsWith(".") && fullName.lastIndexOf(".") === 0;
  const dot = isDotfile ? -1 : fullName.lastIndexOf(".");
  return [
    dot >= 0 ? fullName.slice(0, dot) : fullName,
    dot >= 0 ? fullName.slice(dot) : "",
  ];
}

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
  autoRenameAll: () => Promise<void>;
  undoFileRename: (fileId: string) => Promise<void>;
  autoAccept: boolean;
  toggleAutoAccept: () => void;
  cancelAllOperations: () => void;
  loadHistory: () => Promise<void>;
  undoLastRename: () => Promise<void>;
};

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  generateStatus: "idle",
  renaming: false,
  regeneratingIds: new Set(),
  errorMessage: null,
  autoAccept: false,
  toggleAutoAccept: () => set((state) => ({ autoAccept: !state.autoAccept })),

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

    const unlisten = await listen<RenameSuggestion>("rename-progress", (event) => {
      if (genId !== currentGenId) {
        unlisten();
        return;
      }
      useFileStore.getState().addSuggestion(event.payload);
    });

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
      unlisten();
      if (genId !== currentGenId) return;
      useFileStore.getState().setSuggestions(result);
    } catch (err) {
      unlisten();
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

    for (const op of ops) {
      useFileStore.getState().updateFileStatus(op.fileId, "renaming");
    }

    const unlisten = await listen<{
      file_id: string;
      status: string;
      error?: string;
    }>("rename-exec-status", (event) => {
      if (genId !== currentGenId) {
        unlisten();
        return;
      }
      const p = event.payload;
      if (p.status === "renamed") {
        const store = useFileStore.getState();
        const op = ops.find((o) => o.fileId === p.file_id);
        if (op) {
          const [name, ext] = splitFileName(op.newName);
          store.updateFileName(p.file_id, op.toPath, name, ext);
        }
        store.updateFileStatus(p.file_id, "renamed");
      } else if (p.status === "failed") {
        useFileStore.getState().updateFileStatus(p.file_id, "failed", p.error);
      }
    });

    set({ renaming: true, errorMessage: null });
    try {
      const result = await executeRename(ops);
      unlisten();
      if (genId !== currentGenId) return { success: 0, failed: 0 };
      const fileStore = useFileStore.getState();
      for (const op of result.success) {
        const [name, ext] = splitFileName(op.newName);
        fileStore.updateFileName(op.fileId, op.toPath, name, ext);
        fileStore.updateFileStatus(op.fileId, "renamed");
      }
      for (const op of result.failed) {
        fileStore.updateFileStatus(op.operation.fileId, "failed", op.error);
      }

      // Remove suggestions + deselected renamed files so UI is accurate
      // (files stay visible with "Renamed" status until state is cleared)
      const store = useFileStore.getState();
      const nextSuggestions = { ...store.suggestions };
      const nextSelected = new Set(store.selectedIds);
      for (const op of result.success) {
        delete nextSuggestions[op.fileId];
        nextSelected.delete(op.fileId);
      }
      useFileStore.setState({
        suggestions: nextSuggestions,
        selectedIds: nextSelected,
      });
      if (Object.keys(nextSuggestions).length === 0) {
        useFileStore.getState().setGenerateStatus("idle");
        set({ generateStatus: "idle" });
      }
      get().loadHistory();
      return { success: result.success.length, failed: result.failed.length };
    } catch (err) {
      unlisten();
      const msg = String(err);
      set({ errorMessage: msg, generateStatus: "error" });
      useFileStore.getState().setErrorMessage(msg);
      useFileStore.getState().setGenerateStatus("error");
      return { success: 0, failed: ops.length };
    } finally {
      set({ renaming: false });
    }
  },

  autoRenameAll: async () => {
    const currentGenId = ++genId;
    const fileStore = useFileStore.getState();
    const files = fileStore.files;
    const settings = useSettingsStore.getState();
    if (files.length === 0) return;

    fileStore.setGenerateStatus("generating");
    fileStore.setErrorMessage(null);
    set({ generateStatus: "generating", errorMessage: null });

    const unlisten = await listen<RenameSuggestion>("rename-progress", async (event) => {
      if (genId !== currentGenId) { unlisten(); return; }
      const suggestion = event.payload;
      useFileStore.getState().addSuggestion(suggestion);

      const store = useFileStore.getState();
      const file = store.files.find((f) => f.id === suggestion.fileId);
      if (!file) return;

      let finalName = suggestion.finalName;
      if (file.extension && !finalName.endsWith(file.extension)) {
        finalName = finalName + file.extension;
      }
      const newPath = file.directory ? `${file.directory}/${finalName}` : finalName;

      store.updateFileStatus(suggestion.fileId, "renaming");
      store.setOldPath(suggestion.fileId, file.path);

      try {
        const result = await executeRename([{
          fileId: file.id,
          fromPath: file.path,
          toPath: newPath,
          originalName: file.originalName,
          newName: finalName,
        }]);
        if (genId !== currentGenId) return;
        const st = useFileStore.getState();

        if (result.success.length > 0) {
          const [name, ext] = splitFileName(finalName);
          st.updateFileName(suggestion.fileId, newPath, name, ext);
          st.updateFileStatus(suggestion.fileId, "renamed");
          const next = { ...st.suggestions };
          delete next[suggestion.fileId];
          const nextSel = new Set(st.selectedIds);
          nextSel.delete(suggestion.fileId);
          useFileStore.setState({ suggestions: next, selectedIds: nextSel });
        }
      } catch (err) {
        if (genId !== currentGenId) return;
        useFileStore.getState().updateFileStatus(suggestion.fileId, "failed", String(err));
      }
    });

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
      unlisten();
      if (genId !== currentGenId) return;

      const store = useFileStore.getState();
      const remaining = result.filter((s) => {
        const f = store.files.find((ff) => ff.id === s.fileId);
        return f && f.status === "pending";
      });

      if (remaining.length > 0) {
        store.setSuggestions(remaining);
      } else {
        store.setGenerateStatus("idle");
        set({ generateStatus: "idle" });
      }
    } catch (err) {
      unlisten();
      if (genId !== currentGenId) return;
      const msg = String(err);
      fileStore.setErrorMessage(msg);
      fileStore.setGenerateStatus("error");
      set({ errorMessage: msg, generateStatus: "error" });
    }
  },

  undoFileRename: async (fileId: string) => {
    try {
      const store = useFileStore.getState();
      const file = store.files.find((f) => f.id === fileId);
      if (!file || !file.oldPath) return;

      await undoFileRename(file.path, file.oldPath);

      const pathParts = file.oldPath.replace(/\\/g, "/").split("/");
      const fullName = pathParts[pathParts.length - 1] || "";
      const isDotfile = fullName.startsWith(".") && fullName.lastIndexOf(".") === 0;
      const dot = isDotfile ? -1 : fullName.lastIndexOf(".");
      const ext = dot >= 0 ? fullName.slice(dot) : "";
      const name = dot >= 0 ? fullName.slice(0, dot) : fullName;

      const st = useFileStore.getState();
      st.updateFileName(fileId, file.oldPath, name, ext);
      st.setOldPath(fileId, undefined);
      st.updateFileStatus(fileId, "pending");
    } catch (err) {
      set({ errorMessage: String(err) });
      useFileStore.getState().setErrorMessage(String(err));
    }
  },

  cancelAllOperations: () => {
    genId++;
    cancelGeneration();
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
