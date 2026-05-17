import { tauriInvoke } from "./tauriClient";
import type { RenameSuggestion, RenameOperation, RenameResult } from "../types";

export async function generateRenameSuggestions(input: {
  files: Array<{ id: string; path: string }>;
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  prompt: string;
  options: { style: string; max_words: number; language: string };
}): Promise<RenameSuggestion[]> {
  return tauriInvoke<RenameSuggestion[]>("generate_rename_suggestions", {
    files: input.files,
    provider: input.provider,
    model: input.model,
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    prompt: input.prompt,
    options: input.options,
  });
}

export async function renameFiles(
  operations: RenameOperation[],
): Promise<RenameResult> {
  return tauriInvoke<RenameResult>("rename_files", { operations });
}

export async function cancelGeneration(): Promise<void> {
  return tauriInvoke<void>("cancel_generation");
}

export async function undoFileRename(fromPath: string, toPath: string): Promise<void> {
  return tauriInvoke<void>("undo_file_rename", { fromPath, toPath });
}

export async function undoLastRename(): Promise<{
  restored: number;
  failed: number;
}> {
  return tauriInvoke<{ restored: number; failed: number }>("undo_last_rename");
}
