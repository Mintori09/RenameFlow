export type FileStatus =
  | "pending"
  | "analyzing"
  | "ready"
  | "renaming"
  | "renamed"
  | "failed";

export type FileItem = {
  id: string;
  path: string;
  directory: string;
  originalName: string;
  extension: string;
  size: number;
  mimeType?: string;
  thumbnailPath?: string;
  status: FileStatus;
  error?: string;
};

export type RenameSuggestion = {
  fileId: string;
  originalName: string;
  suggestedName: string;
  finalName: string;
  confidence?: number;
  reason?: string;
};

export type RenameOperation = {
  fileId: string;
  fromPath: string;
  toPath: string;
  originalName: string;
  newName: string;
};

export type RenameHistory = {
  id: string;
  createdAt: string;
  operations: RenameOperation[];
  successCount: number;
  failedCount: number;
};

export type RenameResult = {
  success: RenameOperation[];
  failed: { operation: RenameOperation; error: string }[];
};

export type UndoResult = {
  restored: number;
  failed: number;
};

export type ProviderType =
  | "openai-compatible"
  | "anthropic"
  | "google"
  | "ollama";

export type FilenameStyle =
  | "kebab-case"
  | "snake_case"
  | "title-case"
  | "camelCase";

export type Language = "english" | "vietnamese" | "auto";

export type AppSettings = {
  provider: ProviderType;
  model: string;
  baseUrl: string;
  apiKey: string;
  prompt: string;
  style: FilenameStyle;
  maxWords: number;
  language: Language;
};

export type ModelInfo = {
  name: string;
  label?: string;
};

export type ResolvedPath = {
  path: string;
  name: string;
  isDir: boolean;
};

export type DirEntry = {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
};

export type Provider = {
  name: string;
  providerType: ProviderType;
  baseUrl: string;
  apiKey: string;
  models: string[];
  activeModel: string;
};

export type ProviderConfig = {
  activeProvider: string;
  providers: Provider[];
  activeModelId: string;
};

export type RecentFolder = {
  path: string;
  lastOpened: string;
  label: string;
};
