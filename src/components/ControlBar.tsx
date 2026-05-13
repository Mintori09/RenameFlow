import { useState, useEffect } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { invoke } from "@tauri-apps/api/core";
import type { ModelInfo } from "../types";

type ControlBarProps = {
  onOpenSettings: () => void;
};

export function ControlBar({ onOpenSettings }: ControlBarProps) {
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
          apiKey: settings.apiKey,
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
  }, [settings.provider, settings.baseUrl, settings.apiKey]);

  const charCount = settings.prompt.length;

  return (
    <div className="control-bar">
      <div>
        <div className="field-title">Provider</div>
        <div className="control-provider-display">
          {settings.activeProviderName || "Not configured"}
        </div>
      </div>
      <div>
        <div className="field-title">Model</div>
        <select
          className="control-select"
          value={settings.model}
          onChange={(e) => settings.updateSettings({ model: e.target.value })}
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
      <div>
        <div className="field-title">Prompt / Rule</div>
        <div className="prompt-box">
          <textarea
            className="prompt-textarea-inline"
            value={settings.prompt}
            onChange={(e) => settings.updateSettings({ prompt: e.target.value })}
            placeholder="Describe how files should be renamed..."
            maxLength={500}
          />
          <div className="prompt-meta">
            <span>{charCount} / 500</span>
            <button className="settings-btn" onClick={onOpenSettings}>
              ⚙ Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
