import { invoke } from "@tauri-apps/api/core";
import type { ResolvedPath } from "../types";

export async function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (err) {
    console.error(`[tauri] ${command} failed:`, err);
    throw err;
  }
}

export function getInitialPath() {
  return tauriInvoke<ResolvedPath | null>("get_initial_path");
}
