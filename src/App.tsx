import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { ControlBar } from "./components/ControlBar";
import { FileBrowser } from "./components/FileBrowser";
import { PreviewTable } from "./components/PreviewTable";
import { HistorySection } from "./components/HistorySection";
import { SettingsSection } from "./components/SettingsSection";
import { useFileStore } from "./stores/fileStore";
import { useWorkflowStore } from "./stores/workflowStore";
import { useSettingsStore } from "./stores/settingsStore";
import { invoke } from "@tauri-apps/api/core";
import type { ProviderConfig } from "./types";
import type { View } from "./views";
import "./App.css";

function App() {
  const [view, setView] = useState<View>("home");
  const files = useFileStore((s) => s.files);
  const suggestions = useFileStore((s) => s.suggestions);
  const generateStatus = useFileStore((s) => s.generateStatus);
  const errorMessage = useFileStore((s) => s.errorMessage);
  const {
    loadHistory,
    generateAllSuggestions,
    renameSelectedFiles,
    regenerateSuggestion,
    regeneratingIds,
  } = useWorkflowStore();
  const renaming = useWorkflowStore((s) => s.renaming);

  useEffect(() => {
    loadHistory();
    (async () => {
      try {
        const config = await invoke<ProviderConfig>("load_providers");
        useSettingsStore.getState().loadProviders(config);
      } catch {
        // defaults apply
      }
    })();
  }, []);

  const hasFiles = files.length > 0;
  const hasSuggestions =
    generateStatus === "ready" && Object.keys(suggestions).length > 0;
  const selectedCount = [...useFileStore.getState().selectedIds].filter(
    (id) => suggestions[id],
  ).length;

  async function handleRename() {
    await renameSelectedFiles();
  }

  return (
    <div className="app-layout">
      <Sidebar currentView={view} onNavigate={setView} />
      <main className="main-content">
        {view === "home" && (
          <>
            <div className="top-card">
              <div className="breadcrumb">
                <div className="crumb">
                  <span>Home</span>
                  <span>/</span>
                  <span>Rename</span>
                </div>
                <div className="top-actions">
                  {hasSuggestions && (
                    <button className="btn" onClick={generateAllSuggestions}>
                      ⟳ Regenerate All
                    </button>
                  )}
                  <button
                    className="btn primary"
                    onClick={
                      hasSuggestions ? handleRename : generateAllSuggestions
                    }
                    disabled={
                      generateStatus === "generating" ||
                      renaming ||
                      (hasSuggestions && selectedCount === 0)
                    }
                  >
                    {generateStatus === "generating"
                      ? "Generating..."
                      : renaming
                        ? "Renaming..."
                        : hasSuggestions
                          ? `⟳ Rename Selected (${selectedCount})`
                          : "Generate Names"}
                  </button>
                </div>
              </div>
              <ControlBar />
            </div>

            {errorMessage && <div className="error-banner">{errorMessage}</div>}
          </>
        )}
        <div className={`content-body ${view === 'home' && hasFiles ? 'content-grid' : ''} ${view === 'home' && hasSuggestions ? 'content-split' : ''}`}>
          <div className={view !== 'home' ? 'browser-hidden' : ''}>
            <FileBrowser />
          </div>
          {view === "home" && hasSuggestions && (
            <PreviewTable
              onRegenerateFile={regenerateSuggestion}
              regeneratingIds={regeneratingIds}
            />
          )}
          {view === "history" && <HistorySection />}
          {view === "settings" && <SettingsSection />}
        </div>
      </main>
    </div>
  );
}

export default App;
