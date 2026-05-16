import { useState } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { invoke } from "@tauri-apps/api/core";
import { AddProviderModal } from "./AddProviderModal";
import { getAvailableModels } from "../services/modelService";

export function ProviderManager() {
  const providers = useSettingsStore((s) => s.providers);
  const activeModelId = useSettingsStore((s) => s.activeModelId);
  const removeProvider = useSettingsStore((s) => s.removeProvider);
  const addModelToProvider = useSettingsStore((s) => s.addModelToProvider);
  const removeModelFromProvider = useSettingsStore((s) => s.removeModelFromProvider);
  const setActiveModel = useSettingsStore((s) => s.setActiveModel);
  const persistProviders = useSettingsStore((s) => s.persistProviders);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editProviderName, setEditProviderName] = useState<string | null>(null);
  const [modelInputs, setModelInputs] = useState<Record<string, string>>({});

  async function handleRemove(name: string) {
    removeProvider(name);
    await persistProviders();
  }

  async function handleAddModel(providerName: string, modelName: string) {
    if (!modelName?.trim()) return;
    addModelToProvider(providerName, modelName.trim());
    await persistProviders();
  }

  async function handleRemoveModel(providerName: string, modelName: string) {
    removeModelFromProvider(providerName, modelName);
    await persistProviders();
  }

  async function handleFetchModels(providerName: string) {
    const provider = providers.find((p) => p.name === providerName);
    if (!provider) return;
    try {
      let models: string[];
      if (provider.providerType === "ollama") {
        models = await invoke<string[]>("get_ollama_models");
      } else {
        const fetched = await getAvailableModels({
          provider: provider.providerType,
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
        });
        models = fetched.map((m) => m.name);
      }
      for (const m of models) {
        addModelToProvider(providerName, m);
      }
      await persistProviders();
    } catch (err) {
      alert(`Failed to fetch models: ${err}`);
    }
  }

  return (
    <div className="config-group">
      <label className="config-label">Providers</label>
      <div className="provider-list">
        {providers.map((p) => (
          <div key={p.name} className="provider-item provider-card">
            <div className="provider-item-info">
              <span className="provider-item-name">{p.name}</span>
              <span className="provider-item-type">{p.providerType}</span>
              {activeModelId.startsWith(p.name + "::") && (
                <span className="provider-item-active">(active)</span>
              )}
              <button
                className="provider-item-edit"
                onClick={() => setEditProviderName(p.name)}
                title="Edit provider"
              >
                &#9998;
              </button>
              <button
                className="provider-item-remove"
                onClick={() => handleRemove(p.name)}
                title="Remove provider"
              >
                &minus;
              </button>
            </div>

            <div className="provider-models">
              {p.models.length === 0 && (
                <span className="no-models">No models configured.</span>
              )}
              {p.models.map((m) => (
                <div
                  key={m}
                  className={`model-chip ${
                    activeModelId === `${p.name}::${m}`
                      ? "model-chip-active"
                      : ""
                  }`}
                  onClick={() => {
                    setActiveModel(`${p.name}::${m}`);
                    persistProviders();
                  }}
                  title={
                    activeModelId === `${p.name}::${m}`
                      ? "Active model"
                      : "Click to activate"
                  }
                >
                  <span>{m}</span>
                  <button
                    className="model-chip-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveModel(p.name, m);
                    }}
                    title="Remove model"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>

            <div className="provider-actions">
              <div className="model-input-wrapper">
                <input
                  className="config-input model-add-input"
                  type="text"
                  placeholder="model name"
                  value={modelInputs[p.name] || ""}
                  onChange={(e) =>
                    setModelInputs({
                      ...modelInputs,
                      [p.name]: e.target.value,
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddModel(p.name, modelInputs[p.name]);
                      setModelInputs({ ...modelInputs, [p.name]: "" });
                    }
                  }}
                />
                <button
                  className="provider-add-model-btn"
                  onClick={() => {
                    handleAddModel(p.name, modelInputs[p.name]);
                    setModelInputs({ ...modelInputs, [p.name]: "" });
                  }}
                  disabled={!modelInputs[p.name]?.trim()}
                >
                  Add
                </button>
              </div>
              <button
                className="provider-fetch-btn"
                onClick={() => handleFetchModels(p.name)}
              >
                {p.providerType === "ollama" ? "Fetch from Ollama" : "Fetch models"}
              </button>
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

      {showAddModal && !editProviderName && (
        <AddProviderModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => setShowAddModal(false)}
        />
      )}
      {editProviderName && (
        <AddProviderModal
          editProvider={providers.find(
            (p) => p.name === editProviderName,
          )}
          onClose={() => setEditProviderName(null)}
          onAdded={() => setEditProviderName(null)}
        />
      )}
    </div>
  );
}
