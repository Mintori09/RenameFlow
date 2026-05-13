import { useState } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import type { Provider, ProviderType } from "../types";

const DEFAULT_BASE_URLS: Record<ProviderType, string> = {
  "openai-compatible": "http://localhost:11434",
  anthropic: "https://api.anthropic.com",
  google: "https://generativelanguage.googleapis.com",
  ollama: "http://localhost:11434",
};

const AUTH_REQUIRED: Record<ProviderType, boolean> = {
  "openai-compatible": false,
  anthropic: true,
  google: true,
  ollama: false,
};

type Props = {
  onClose: () => void;
  onAdded: () => void;
};

export function AddProviderModal({ onClose, onAdded }: Props) {
  const { addProvider, persistProviders, setActiveModel } =
    useSettingsStore();
  const [name, setName] = useState("");
  const [providerType, setProviderType] =
    useState<ProviderType>("ollama");
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URLS["ollama"]);
  const [apiKey, setApiKey] = useState("");
  const [modelsInput, setModelsInput] = useState("");

  function handleTypeChange(type: string) {
    const t = type as ProviderType;
    setProviderType(t);
    setBaseUrl(DEFAULT_BASE_URLS[t]);
  }

  async function handleSubmit() {
    if (!name.trim()) return;
    const modelList = modelsInput
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    const firstModel = modelList[0] || "";
    const provider: Provider = {
      name: name.trim(),
      providerType,
      baseUrl: baseUrl.trim(),
      apiKey,
      models: modelList,
      activeModel: firstModel,
    };
    addProvider(provider);
    if (firstModel) {
      setActiveModel(`${provider.name}::${firstModel}`);
    }
    await persistProviders();
    onAdded();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Add Provider</h3>

        <div className="modal-field">
          <label className="config-label">Name</label>
          <input
            className="config-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My Ollama"
          />
        </div>

        <div className="modal-field">
          <label className="config-label">Type</label>
          <select
            className="config-select"
            value={providerType}
            onChange={(e) => handleTypeChange(e.target.value)}
          >
            <option value="ollama">Ollama</option>
            <option value="openai-compatible">OpenAI Compatible</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google</option>
          </select>
        </div>

        <div className="modal-field">
          <label className="config-label">Base URL</label>
          <input
            className="config-input"
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </div>

        {AUTH_REQUIRED[providerType] && (
          <div className="modal-field">
            <label className="config-label">API Key</label>
            <input
              className="config-input"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Leave empty to use env var"
            />
          </div>
        )}

        <div className="modal-field">
          <label className="config-label">Models</label>
          <input
            className="config-input"
            type="text"
            value={modelsInput}
            onChange={(e) => setModelsInput(e.target.value)}
            placeholder="llama3.2, mistral, codellama (comma-separated)"
          />
        </div>

        <div className="modal-actions">
          <button className="modal-btn modal-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="modal-btn modal-btn-add"
            onClick={handleSubmit}
            disabled={!name.trim()}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
