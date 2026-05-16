import { tauriInvoke } from "./tauriClient";
import type { RenameHistory, UndoResult } from "../types";

export async function loadRenameHistory(): Promise<RenameHistory[]> {
  return tauriInvoke<RenameHistory[]>("load_rename_history");
}

export async function undoHistoryEntry(id: string): Promise<UndoResult> {
  return tauriInvoke<UndoResult>("undo_history_entry", { id });
}
