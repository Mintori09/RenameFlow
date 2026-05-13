import { create } from "zustand";
import type { AppSettings, ProviderType, FilenameStyle, Language } from "../types";

const DEFAULT_SETTINGS: AppSettings = {
  provider: "ollama" as ProviderType,
  model: "",
  baseUrl: "http://localhost:11434",
  prompt: "Rename the file based on its content. Keep it short, descriptive, lowercase, and use hyphens.",
  style: "kebab-case" as FilenameStyle,
  maxWords: 8,
  language: "english" as Language,
};

type SettingsStore = AppSettings & {
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  ...DEFAULT_SETTINGS,
  updateSettings: (partial) => set(partial),
  resetSettings: () => set(DEFAULT_SETTINGS),
}));
