import { invoke } from "@tauri-apps/api/core";

export function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
) {
  return invoke<T>(command, args);
}
