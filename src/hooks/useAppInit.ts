import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useWorkflowStore } from "../stores/workflowStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useRecentStore } from "../stores/recentStore";
import { getInitialPath } from "../services/tauriClient";
import type { ProviderConfig, ResolvedPath } from "../types";

export function useAppInit(
  onCliPath: (path: ResolvedPath | null) => void,
) {
  useEffect(() => {
    useWorkflowStore.getState().loadHistory();

    (async () => {
      try {
        const config = await invoke<ProviderConfig>("load_providers");
        useSettingsStore.getState().loadProviders(config);
      } catch {
        // defaults apply
      }

      try {
        const initial = await getInitialPath();
        if (initial) onCliPath(initial);
      } catch {
        // no CLI path
      }
    })();

    useRecentStore.getState().loadRecentFolders();
  }, []);
}
