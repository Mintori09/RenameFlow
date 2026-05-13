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
        const config = await invoke<ProviderConfig>("load_providers");
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

  async function handleAddModel(providerName: string) {
    const modelName = prompt(`Add model to "${providerName}":`);
    if (!modelName?.trim()) return;
    settings.addModelToProvider(providerName, modelName.trim());
    await settings.persistProviders();
  }

  async function handleRemoveModel(
    providerName: string,
    modelName: string,
  ) {
    if (
      !confirm(`Remove model "${modelName}" from "${providerName}"?`)
    )
      return;
    settings.removeModelFromProvider(providerName, modelName);
    await settings.persistProviders();
  }

  async function handleFetchOllamaModels(providerName: string) {
    try {
      const models = await invoke<string[]>("get_ollama_models");
      for (const m of models) {
        settings.addModelToProvider(providerName, m);
      }
      await settings.persistProviders();
    } catch (err) {
      alert(`Failed to fetch Ollama models: ${err}`);
    }
  }

  return (
    <div className="section">
      <h2 className="section-title">Settings</h2>
      <div className="settings-form">
        <div className="config-group">
          <label className="config-label">Providers</label>
          <div className="provider-list">
            {settings.providers.map((p) => (
              <div key={p.name} className="provider-item provider-card">
                <div className="provider-item-info">
                  <span className="provider-item-name">{p.name}</span>
                  <span className="provider-item-type">
                    {p.providerType}
                  </span>
                  {settings.activeModelId.startsWith(p.name + "::") && (
                    <span className="provider-item-active">(active)</span>
                  )}
                </div>
                <button
                  className="provider-item-remove"
                  onClick={() => handleRemove(p.name)}
                  title="Remove provider"
                >
                  &minus;
                </button>
                <div className="provider-models">
                  {p.models.length === 0 && (
                    <span className="no-models">
                      No models configured.
                    </span>
                  )}
                  {p.models.map((m) => (
                    <div key={m} className="model-chip">
                      <span
                        className={
                          settings.activeModelId === `${p.name}::${m}`
                            ? "model-chip-active"
                            : ""
                        }
                      >
                        {m}
                      </span>
                      <button
                        className="model-chip-remove"
                        onClick={() => handleRemoveModel(p.name, m)}
                        title="Remove model"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
                <div className="provider-actions">
                  <button
                    className="provider-add-model-btn"
                    onClick={() => handleAddModel(p.name)}
                  >
                    + Add Model
                  </button>
                  {p.providerType === "ollama" && (
                    <button
                      className="provider-fetch-btn"
                      onClick={() => handleFetchOllamaModels(p.name)}
                    >
                      Fetch from Ollama
                    </button>
                  )}
                </div>
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
