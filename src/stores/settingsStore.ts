import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  AppSettings,
  ProviderType,
  FilenameStyle,
  Language,
  Provider,
  ProviderConfig,
} from "../types";

const DEFAULT_SETTINGS: AppSettings = {
  provider: "ollama" as ProviderType,
  model: "",
  baseUrl: "http://localhost:11434",
  apiKey: "",
  prompt:
    "Rename the file based on its content. Keep it short, descriptive, lowercase, and use hyphens.",
  style: "kebab-case" as FilenameStyle,
  maxWords: 8,
  language: "english" as Language,
};

type SettingsStore = AppSettings & {
  providers: Provider[];
  activeModelId: string;
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
  loadProviders: (config: ProviderConfig) => void;
  addProvider: (provider: Provider) => void;
  removeProvider: (name: string) => void;
  addModelToProvider: (providerName: string, modelName: string) => void;
  removeModelFromProvider: (providerName: string, modelName: string) => void;
  setActiveModel: (modelId: string) => void;
  persistProviders: () => Promise<void>;
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,
  providers: [],
  activeModelId: "",

  updateSettings: (partial) => set(partial),

  resetSettings: () => set(DEFAULT_SETTINGS),

  loadProviders: (config: ProviderConfig) => {
    set({
      providers: config.providers,
      activeModelId: config.activeModelId,
    });
    if (config.activeModelId) {
      const [providerName, modelName] = config.activeModelId.split("::");
      const provider = config.providers.find((p) => p.name === providerName);
      if (provider && modelName) {
        set({
          provider: provider.providerType,
          model: modelName,
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
        });
      }
    }
  },

  addProvider: (provider: Provider) => {
    set((state) => ({
      providers: [...state.providers, provider],
    }));
  },

  removeProvider: (name: string) => {
    const state = get();
    const remaining = state.providers.filter((p) => p.name !== name);
    let newId = state.activeModelId;
    if (state.activeModelId.startsWith(name + "::")) {
      newId = "";
    }
    set({ providers: remaining, activeModelId: newId });
  },

  addModelToProvider: (providerName: string, modelName: string) => {
    set((state) => ({
      providers: state.providers.map((p) =>
        p.name === providerName && !p.models.includes(modelName)
          ? { ...p, models: [...p.models, modelName] }
          : p,
      ),
    }));
  },

  removeModelFromProvider: (providerName: string, modelName: string) => {
    const state = get();
    const provider = state.providers.find((p) => p.name === providerName);
    if (!provider) return;

    const remaining = provider.models.filter((m) => m !== modelName);
    let newModelId = state.activeModelId;
    if (state.activeModelId === `${providerName}::${modelName}`) {
      newModelId =
        remaining.length > 0 ? `${providerName}::${remaining[0]}` : "";
    }

    set({
      providers: state.providers.map((p) =>
        p.name === providerName ? { ...p, models: remaining } : p,
      ),
      activeModelId: newModelId,
    });
  },

  setActiveModel: (modelId: string) => {
    const [providerName, modelName] = modelId.split("::");
    const provider = get().providers.find((p) => p.name === providerName);
    if (!provider || !modelName) return;

    set({
      activeModelId: modelId,
      provider: provider.providerType,
      model: modelName,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
    });
  },

  persistProviders: async () => {
    const state = get();
    const config: ProviderConfig = {
      activeProvider: state.activeModelId.split("::")[0] || "",
      providers: state.providers,
      activeModelId: state.activeModelId,
    };
    try {
      await invoke("save_providers", { config });
    } catch (err) {
      console.error("Failed to save providers:", err);
    }
  },
}));
