import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { RecentFolder } from "../types";

type RecentStore = {
  recentFolders: RecentFolder[];
  loading: boolean;
  loadRecentFolders: () => Promise<void>;
  addRecentFolder: (path: string) => Promise<void>;
  removeRecentFolder: (path: string) => Promise<void>;
};

export const useRecentStore = create<RecentStore>((set, get) => ({
  recentFolders: [],
  loading: false,

  loadRecentFolders: async () => {
    try {
      const folders = await invoke<RecentFolder[]>("load_recent_folders");
      set({ recentFolders: folders });
    } catch (err) {
      console.error("[renameflow] Failed to load recent folders:", err);
    }
  },

  addRecentFolder: async (path: string) => {
    try {
      await invoke("add_recent_folder", { path });
      await get().loadRecentFolders();
    } catch (err) {
      console.error("[renameflow] Failed to add recent folder:", err);
    }
  },

  removeRecentFolder: async (path: string) => {
    try {
      await invoke("remove_recent_folder", { path });
      await get().loadRecentFolders();
    } catch (err) {
      console.error("[renameflow] Failed to remove recent folder:", err);
    }
  },
}));
