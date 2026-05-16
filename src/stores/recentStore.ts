import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { RecentFolder, WorkspaceProfile } from "../types";

type RecentStore = {
  recentFolders: RecentFolder[];
  profiles: WorkspaceProfile[];
  loading: boolean;
  loadRecentFolders: () => Promise<void>;
  addRecentFolder: (path: string) => Promise<void>;
  removeRecentFolder: (path: string) => Promise<void>;
  loadProfiles: () => Promise<void>;
  saveProfile: (profile: WorkspaceProfile) => Promise<void>;
  deleteProfile: (name: string) => Promise<void>;
};

export const useRecentStore = create<RecentStore>((set, get) => ({
  recentFolders: [],
  profiles: [],
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

  loadProfiles: async () => {
    try {
      const profiles = await invoke<WorkspaceProfile[]>(
        "load_workspace_profiles",
      );
      set({ profiles });
    } catch (err) {
      console.error("[renameflow] Failed to load profiles:", err);
    }
  },

  saveProfile: async (profile: WorkspaceProfile) => {
    try {
      await invoke("save_workspace_profile", { profile });
      await get().loadProfiles();
    } catch (err) {
      console.error("[renameflow] Failed to save profile:", err);
    }
  },

  deleteProfile: async (name: string) => {
    try {
      await invoke("delete_workspace_profile", { name });
      await get().loadProfiles();
    } catch (err) {
      console.error("[renameflow] Failed to delete profile:", err);
    }
  },
}));
