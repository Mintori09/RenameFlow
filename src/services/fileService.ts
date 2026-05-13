import { tauriInvoke } from "./tauriClient";
import type { DirEntry } from "../types";

export async function listDirectory(path: string): Promise<DirEntry[]> {
  return tauriInvoke<DirEntry[]>("list_directory", { path });
}

export async function collectFiles(dirPath: string): Promise<string[]> {
  const entries = await listDirectory(dirPath);
  const files: string[] = [];
  const dirs: string[] = [];

  for (const entry of entries) {
    if (entry.is_dir) {
      dirs.push(entry.path);
    } else {
      files.push(entry.path);
    }
  }

  for (const dir of dirs) {
    const subFiles = await collectFiles(dir);
    files.push(...subFiles);
  }

  return files;
}
