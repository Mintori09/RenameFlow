import { useState } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Sidebar } from "./components/Sidebar";
import { ControlBar } from "./components/ControlBar";
import { DragDropOverlay } from "./components/DragDropOverlay";
import { FileBrowser } from "./components/FileBrowser";
import { HistorySection } from "./components/HistorySection";
import { SettingsSection } from "./components/SettingsSection";
import { HomeToolbar } from "./components/HomeToolbar";
import { useAppInit } from "./hooks/useAppInit";
import { useFileDrop } from "./hooks/useFileDrop";
import { useWorkflowStore } from "./stores/workflowStore";
import type { View } from "./views";
import type { ResolvedPath } from "./types";
import "./App.css";

function App() {
  const [view, setView] = useState<View>("home");
  const [cliPath, setCliPath] = useState<ResolvedPath | null>(null);
  const renameSelectedFiles = useWorkflowStore(
    (s) => s.renameSelectedFiles,
  );

  useAppInit(setCliPath);
  const { dragState, error } = useFileDrop();

  return (
    <ErrorBoundary>
      <div className="app-layout">
        <Sidebar currentView={view} onNavigate={setView} />
        <main className="main-content">
          {view === "home" && (
            <>
              <HomeToolbar onRename={renameSelectedFiles} />
              <ControlBar />
            </>
          )}
          {view === "home" && (
            <div className="content-body">
              <FileBrowser cliPath={cliPath} />
            </div>
          )}
          {view === "history" && <HistorySection />}
          {view === "settings" && <SettingsSection />}
        </main>
      </div>
      <DragDropOverlay dragState={dragState} />
      {error && <div className="drop-error-toast">{error}</div>}
    </ErrorBoundary>
  );
}

export default App;
