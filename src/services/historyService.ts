import { tauriInvoke } from "./tauriClient";
import type { RenameHistory } from "../types";

export async function loadRenameHistory(): Promise<RenameHistory[]> {
  return tauriInvoke<RenameHistory[]>("load_rename_history");
}
