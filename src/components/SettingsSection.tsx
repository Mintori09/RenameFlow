import { useEffect, useState } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { invoke } from "@tauri-apps/api/core";
import type { ProviderConfig } from "../types";
import { AddProviderModal } from "./AddProviderModal";

export function SettingsSection() {
  const settings = useSettingsStore();
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const [config, _path] = await Promise.all([
          invoke<ProviderConfig>("load_providers"),
          invoke<string>("get_providers_path"),
        ]);
        settings.loadProviders(config);
      } catch {
        // defaults apply
      }
    }
    init();
  }, []);

  async function handleRemove(name: string) {
    settings.removeProvider(name);
    await settings.persistProviders();
  }

  async function handleSwitch(name: string) {
    settings.switchProvider(name);
    await settings.persistProviders();
  }

  return (
    <div className="section">
      <h2 className="section-title">Settings</h2>
      <div className="settings-form">
        <div className="config-group">
          <label className="config-label">Active Provider</label>
          <select
            className="config-select"
            value={settings.activeProviderName}
            onChange={(e) => handleSwitch(e.target.value)}
          >
            {settings.providers.length === 0 && (
              <option value="">No providers</option>
            )}
            {settings.providers.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="config-group">
          <label className="config-label">Providers</label>
          <div className="provider-list">
            {settings.providers.map((p) => (
              <div key={p.name} className="provider-item">
                <div className="provider-item-info">
                  <span className="provider-item-name">{p.name}</span>
                  <span className="provider-item-type">{p.providerType}</span>
                  <span className="provider-item-model">{p.model || "no model"}</span>
                </div>
                <button
                  className="provider-item-remove"
                  onClick={() => handleRemove(p.name)}
                  title="Remove provider"
                >
                  &minus;
                </button>
              </div>
            ))}
          </div>
          <button
            className="provider-add-btn"
            onClick={() => setShowAddModal(true)}
          >
            + Add Provider
          </button>
        </div>

        <hr className="settings-divider" />

        <div className="config-group">
          <label className="config-label">Prompt</label>
          <textarea
            className="config-textarea"
            rows={3}
            value={settings.prompt}
            onChange={(e) =>
              settings.updateSettings({ prompt: e.target.value })
            }
          />
        </div>

        <div className="config-group">
          <label className="config-label">Filename Style</label>
          <select
            className="config-select"
            value={settings.style}
            onChange={(e) =>
              settings.updateSettings({ style: e.target.value as any })
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
            value={settings.maxWords}
            onChange={(e) =>
              settings.updateSettings({
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
            value={settings.language}
            onChange={(e) =>
              settings.updateSettings({ language: e.target.value as any })
            }
          >
            <option value="english">English</option>
            <option value="vietnamese">Vietnamese</option>
            <option value="auto">Auto</option>
          </select>
        </div>
      </div>

      {showAddModal && (
        <AddProviderModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
