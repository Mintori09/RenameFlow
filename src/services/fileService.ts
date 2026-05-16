import { tauriInvoke } from "./tauriClient";
import type { DirEntry } from "../types";

export async function listDirectory(path: string): Promise<DirEntry[]> {
  return tauriInvoke<DirEntry[]>("list_directory", { path });
}

export async function collectFiles(dirPath: string): Promise<string[]> {
  let entries: DirEntry[];
  try {
    entries = await listDirectory(dirPath);
  } catch {
    return [];
  }
  const files: string[] = [];
  const dirs: string[] = [];

  for (const entry of entries) {
    if (entry.is_dir) {
      dirs.push(entry.path);
    } else {
      files.push(entry.path);
    }
  }

  const subFiles = await Promise.all(dirs.map((d) => collectFiles(d)));
  for (const sf of subFiles) {
    files.push(...sf);
  }

  return files;
}
