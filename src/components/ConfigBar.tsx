import { useState, useEffect } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { invoke } from "@tauri-apps/api/core";
import type { ModelInfo } from "../types";

export function ConfigBar() {
  const settings = useSettingsStore();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    async function fetchModels() {
      setLoadingModels(true);
      try {
        const result = await invoke<ModelInfo[]>("get_available_models", {
          provider: settings.provider,
          baseUrl: settings.baseUrl,
        });
        setModels(result);
        if (result.length > 0 && !settings.model) {
          settings.updateSettings({ model: result[0].name });
        }
      } catch {
        setModels([]);
      }
      setLoadingModels(false);
    }
    fetchModels();
  }, [settings.provider, settings.baseUrl]);

  return (
    <div className="config-bar">
      <div className="config-row">
        <div className="config-group">
          <label className="config-label">Provider</label>
          <select
            className="config-select"
            value={settings.provider}
            onChange={(e) =>
              settings.updateSettings({ provider: e.target.value as any })
            }
          >
            <option value="ollama">Ollama</option>
            <option value="lm-studio">LM Studio</option>
          </select>
        </div>
        <div className="config-group">
          <label className="config-label">Base URL</label>
          <input
            className="config-input"
            type="text"
            value={settings.baseUrl}
            onChange={(e) =>
              settings.updateSettings({ baseUrl: e.target.value })
            }
            placeholder="http://localhost:11434"
          />
        </div>
        <div className="config-group">
          <label className="config-label">Model</label>
          <select
            className="config-select"
            value={settings.model}
            onChange={(e) =>
              settings.updateSettings({ model: e.target.value })
            }
            disabled={loadingModels}
          >
            {loadingModels && <option>Loading...</option>}
            {models.length === 0 && !loadingModels && (
              <option value="">No models found</option>
            )}
            {models.map((m) => (
              <option key={m.name} value={m.name}>
                {m.label || m.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
