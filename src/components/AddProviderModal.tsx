import { useState } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import type { Provider, ProviderType } from "../types";

const DEFAULT_BASE_URLS: Record<ProviderType, string> = {
  "openai-compatible": "http://localhost:11434",
  anthropic: "https://api.anthropic.com",
  google: "https://generativelanguage.googleapis.com",
  ollama: "http://localhost:11434",
};

type Props = {
  onClose: () => void;
  onAdded: () => void;
  editProvider?: Provider;
};

export function AddProviderModal({ onClose, onAdded, editProvider }: Props) {
  const { addProvider, updateProvider, persistProviders, setActiveModel } =
    useSettingsStore();
  const [name, setName] = useState(editProvider?.name ?? "");
  const [providerType, setProviderType] =
    useState<ProviderType>(editProvider?.providerType ?? "ollama");
  const [baseUrl, setBaseUrl] = useState(editProvider?.baseUrl ?? DEFAULT_BASE_URLS["ollama"]);
  const [apiKey, setApiKey] = useState(editProvider?.apiKey ?? "");
  const [modelsInput, setModelsInput] = useState(
    editProvider ? editProvider.models.join(", ") : "",
  );

  function handleTypeChange(type: string) {
    const t = type as ProviderType;
    setProviderType(t);
    setBaseUrl(DEFAULT_BASE_URLS[t]);
  }

  async function handleSubmit() {
    if (!name.trim()) return;
    const providers = useSettingsStore.getState().providers;
    if (!editProvider && providers.some((p) => p.name === name.trim())) {
      alert(`Provider "${name.trim()}" already exists.`);
      return;
    }
    if (editProvider && editProvider.name !== name.trim() && providers.some((p) => p.name === name.trim())) {
      alert(`Provider "${name.trim()}" already exists.`);
      return;
    }
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

    if (editProvider) {
      updateProvider(editProvider.name, provider);
      if (editProvider.name !== provider.name && firstModel) {
        setActiveModel(`${provider.name}::${firstModel}`);
      }
    } else {
      addProvider(provider);
      if (firstModel) {
        setActiveModel(`${provider.name}::${firstModel}`);
      }
    }

    await persistProviders();
    onAdded();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{editProvider ? "Edit Provider" : "Add Provider"}</h3>

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
            {editProvider ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
