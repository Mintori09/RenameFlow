import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { DropZone } from "./components/DropZone";
import { ConfigBar } from "./components/ConfigBar";
import { PromptField } from "./components/PromptField";
import { FileList } from "./components/FileList";
import { PreviewTable } from "./components/PreviewTable";
import { HistorySection } from "./components/HistorySection";
import { SettingsSection } from "./components/SettingsSection";
import { useFileStore } from "./stores/fileStore";
import { useSettingsStore } from "./stores/settingsStore";
import { invoke } from "@tauri-apps/api/core";
import type { View } from "./views";
import type { RenameSuggestion, RenameOperation, RenameResult } from "./types";
import "./App.css";

function App() {
  const [view, setView] = useState<View>("home");
  const {
    files,
    suggestions,
    selectedIds,
    generateStatus,
    errorMessage,
    addFiles,
    setSuggestions,
    setGenerateStatus,
    setErrorMessage,
  } = useFileStore();
  const settings = useSettingsStore();

  async function handleGenerate() {
    if (files.length === 0) return;
    setGenerateStatus("generating");
    setErrorMessage(null);

    try {
      const result = await invoke<RenameSuggestion[]>("generate_rename_suggestions", {
        files: files.map((f) => f.path),
        provider: settings.provider,
        model: settings.model,
        baseUrl: settings.baseUrl,
        prompt: settings.prompt,
        options: {
          style: settings.style,
          max_words: settings.maxWords,
          language: settings.language,
        },
      });
      setSuggestions(result);
    } catch (err) {
      setErrorMessage(String(err));
      setGenerateStatus("error");
    }
  }

  async function handleRename() {
    const store = useFileStore.getState();
    const ops: RenameOperation[] = [];
    for (const fileId of store.selectedIds) {
      const file = store.files.find((f) => f.id === fileId);
      const s = store.suggestions[fileId];
      if (!file || !s) continue;
      const newPath = file.directory
        ? `${file.directory}/${s.finalName}`
        : s.finalName;
      ops.push({
        fileId: file.id,
        fromPath: file.path,
        toPath: newPath,
        originalName: file.originalName,
        newName: s.finalName,
      });
    }
    if (ops.length === 0) return;

    try {
      const result = await invoke<RenameResult>("rename_files", { operations: ops });
      for (const op of result.success) {
        store.updateFileStatus(op.fileId, "renamed");
      }
      for (const op of result.failed) {
        store.updateFileStatus(op.operation.fileId, "failed", op.error);
      }
    } catch (err) {
      setErrorMessage(String(err));
    }
  }

  return (
    <div className="app-layout">
      <Sidebar currentView={view} onNavigate={setView} />
      <main className="main-content">
        {view === "home" && (
          <>
            <DropZone onFilesSelected={addFiles} />
            <ConfigBar />
            <PromptField />
            <div className="action-bar">
              <button
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={files.length === 0 || generateStatus === "generating"}
              >
                {generateStatus === "generating" ? "Generating..." : "Generate Names"}
              </button>
            </div>
            {errorMessage && <div className="error-banner">{errorMessage}</div>}
            {files.length > 0 && <FileList />}
            {generateStatus === "ready" && Object.keys(suggestions).length > 0 && (
              <PreviewTable onRename={handleRename} onRegenerateFile={async () => {}} regeneratingIds={new Set()} />
            )}
          </>
        )}
        {view === "history" && <HistorySection />}
        {view === "settings" && <SettingsSection />}
      </main>
    </div>
  );
}

export default App;
