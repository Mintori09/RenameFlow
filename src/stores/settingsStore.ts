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
  provider: "openai-compatible" as ProviderType,
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
  activeProviderName: string;
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
  loadProviders: (config: ProviderConfig) => void;
  addProvider: (provider: Provider) => void;
  removeProvider: (name: string) => void;
  switchProvider: (name: string) => void;
  persistProviders: () => Promise<void>;
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,
  providers: [],
  activeProviderName: "",

  updateSettings: (partial) => set(partial),

  resetSettings: () => set(DEFAULT_SETTINGS),

  loadProviders: (config: ProviderConfig) => {
    set({ providers: config.providers, activeProviderName: config.activeProvider });
    const active = config.providers.find((p) => p.name === config.activeProvider);
    if (active) {
      set({
        provider: active.providerType,
        model: active.model,
        baseUrl: active.baseUrl,
        apiKey: active.apiKey,
      });
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
    let newActive = state.activeProviderName;
    if (name === state.activeProviderName) {
      const first = remaining[0];
      if (first) {
        newActive = first.name;
        set({
          provider: first.providerType,
          model: first.model,
          baseUrl: first.baseUrl,
          apiKey: first.apiKey,
        });
      } else {
        newActive = "";
      }
    }
    set({ providers: remaining, activeProviderName: newActive });
  },

  switchProvider: (name: string) => {
    const state = get();
    const provider = state.providers.find((p) => p.name === name);
    if (provider) {
      set({
        activeProviderName: name,
        provider: provider.providerType,
        model: provider.model,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
      });
    }
  },

  persistProviders: async () => {
    const state = get();
    const config: ProviderConfig = {
      activeProvider: state.activeProviderName,
      providers: state.providers,
    };
    try {
      await invoke("save_providers", { config });
    } catch (err) {
      console.error("Failed to save providers:", err);
    }
  },
}));
