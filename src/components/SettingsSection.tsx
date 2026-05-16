import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "../stores/settingsStore";
import { ProviderManager } from "./ProviderManager";
import type { ProviderConfig } from "../types";

export function SettingsSection() {
  const prompt = useSettingsStore((s) => s.prompt);
  const style = useSettingsStore((s) => s.style);
  const maxWords = useSettingsStore((s) => s.maxWords);
  const language = useSettingsStore((s) => s.language);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const loadProviders = useSettingsStore((s) => s.loadProviders);

  useEffect(() => {
    async function init() {
      try {
        const config = await invoke<ProviderConfig>("load_providers");
        loadProviders(config);
      } catch {
        // defaults apply
      }
    }
    init();
  }, []);

  return (
    <div className="section">
      <h2 className="section-title">Settings</h2>
      <div className="settings-form">
        <ProviderManager />

        <hr className="settings-divider" />

        <div className="config-group">
          <label className="config-label">Prompt</label>
          <textarea
            className="config-textarea"
            rows={3}
            value={prompt}
            onChange={(e) =>
              updateSettings({ prompt: e.target.value })
            }
          />
        </div>

        <div className="settings-compact-row">
          <div className="config-group">
            <label className="config-label">Filename Style</label>
            <select
              className="config-select"
              value={style}
              onChange={(e) =>
                updateSettings({ style: e.target.value as any })
              }
            >
              <option value="kebab-case">kebab-case</option>
              <option value="snake_case">snake_case</option>
              <option value="title-case">Title Case</option>
              <option value="camelCase">camelCase</option>
            </select>
          </div>

          <div className="config-group">
            <label className="config-label">Max Words</label>
            <input
              className="config-input"
              type="number"
              value={maxWords}
              onChange={(e) =>
                updateSettings({
                  maxWords: parseInt(e.target.value) || 8,
                })
              }
              min={1}
              max={20}
            />
          </div>

          <div className="config-group">
            <label className="config-label">Language</label>
            <select
              className="config-select"
              value={language}
              onChange={(e) =>
                updateSettings({ language: e.target.value as any })
              }
            >
              <option value="english">English</option>
              <option value="vietnamese">Vietnamese</option>
              <option value="auto">Auto</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
