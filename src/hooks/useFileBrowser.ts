import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { useFileStore } from "../stores/fileStore";
import { useRecentStore } from "../stores/recentStore";
import { listDirectory } from "../services/fileService";
import type { DirEntry, ResolvedPath } from "../types";

export function parentDir(p: string): string {
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(0, i) : p;
}

export type FileBrowserState = ReturnType<typeof useFileBrowser>;

export function useFileBrowser(cliPath: ResolvedPath | null) {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [children, setChildren] = useState<Map<string, DirEntry[]>>(new Map());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [browserError, setBrowserError] = useState<string | null>(null);
  const [localRefreshTrigger, setLocalRefreshTrigger] = useState(0);

  const storeFiles = useFileStore((s) => s.files);
  const dropSourcePaths = useFileStore((s) => s.dropSourcePaths);
  const suggestions = useFileStore((s) => s.suggestions);
  const generateStatus = useFileStore((s) => s.generateStatus);
  const addFiles = useFileStore((s) => s.addFiles);
  const removeFilesByPaths = useFileStore((s) => s.removeFilesByPaths);
  const updateSuggestion = useFileStore((s) => s.updateSuggestion);
  const recentFolders = useRecentStore((s) => s.recentFolders);
  const removeRecentFolder = useRecentStore((s) => s.removeRecentFolder);

  const hasAnySuggestions = Object.keys(suggestions).length > 0;
  const checkedPaths = new Set(storeFiles.map((f) => f.path));
  const filePathMap = new Map(storeFiles.map((f) => [f.path, f.id]));

  // Handle CLI-provided path
  useEffect(() => {
    if (!cliPath) return;
    if (cliPath.isDir) {
      setRootPath(cliPath.path);
      setExpanded(new Set([cliPath.path]));
      setChildren(new Map());
      loadChildren(cliPath.path);
    } else {
      const parent = parentDir(cliPath.path);
      setRootPath(parent);
      setExpanded(new Set([parent]));
      setChildren(new Map());
      loadChildren(parent);
      addFiles([cliPath.path]);
    }
  }, [cliPath]);

  // Refresh browser when trigger changes
  useEffect(() => {
    if (localRefreshTrigger > 0 && expanded.size > 0) {
      const dirs = Array.from(expanded);
      for (const dir of dirs) {
        loadChildren(dir);
      }
    }
  }, [localRefreshTrigger, expanded]);

  // File system watcher
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let mounted = true;

    const setupWatcher = async (path: string) => {
      try {
        await invoke("stop_watching");
      } catch {}
      if (!mounted) return;
      await invoke("start_watching", { paths: [path] });
      if (!mounted) return;
      unlisten = await listen("fs-changes", () => {
        setLocalRefreshTrigger((n) => n + 1);
      });
    };

    if (rootPath) {
      setupWatcher(rootPath);
    }

    return () => {
      mounted = false;
      if (unlisten) unlisten();
      invoke("stop_watching").catch(() => {});
    };
  }, [rootPath]);

  // Drop-mode watcher: watch parent directories of dropped files
  useEffect(() => {
    if (rootPath) return;
    if (dropSourcePaths.length === 0) return;

    let unlisten: (() => void) | null = null;
    let mounted = true;

    const setup = async () => {
      try {
        await invoke("stop_watching");
      } catch {}
      if (!mounted) return;

      const currentFiles = useFileStore.getState().files;
      const watchDirs = [...new Set(currentFiles.map((f) => f.directory))];
      if (watchDirs.length === 0) return;

      await invoke("start_watching", { paths: watchDirs });
      if (!mounted) return;

      unlisten = await listen("fs-changes", async () => {
        try {
          const store = useFileStore.getState();
          if (store.dropSourcePaths.length === 0) return;

          const resolved = await invoke<string[]>("resolve_drop_paths", {
            paths: store.dropSourcePaths,
          });
          if (!mounted) return;

          const currentPaths = new Set(store.files.map((f) => f.path));
          const resolvedSet = new Set(resolved);

          const toRemove = store.files
            .filter((f) => !resolvedSet.has(f.path))
            .map((f) => f.path);
          const toAdd = resolved.filter((p) => !currentPaths.has(p));

          if (toRemove.length > 0) {
            useFileStore.getState().removeFilesByPaths(toRemove);
          }
          if (toAdd.length > 0) {
            useFileStore.getState().addFiles(toAdd);
          }
        } catch (err) {
          console.error("[useFileBrowser] drop reconcile failed:", err);
        }
      });
    };

    setup();

    return () => {
      mounted = false;
      if (unlisten) unlisten();
      invoke("stop_watching").catch(() => {});
    };
  }, [rootPath, dropSourcePaths, storeFiles.length]);

  const loadChildren = useCallback(async (dir: string) => {
    setLoading((prev) => new Set(prev).add(dir));
    try {
      const entries = await invoke<DirEntry[]>("list_directory", {
        path: dir,
      });
      setChildren((prev) => new Map(prev).set(dir, entries));
      setBrowserError(null);
    } catch {
      setBrowserError("Failed to load folder contents");
    }
    setLoading((prev) => {
      const next = new Set(prev);
      next.delete(dir);
      return next;
    });
  }, []);

  const navigateToFolder = useCallback(
    async (path: string) => {
      useFileStore.getState().clearAll();
      setRootPath(path);
      setExpanded(new Set([path]));
      setChildren(new Map());
      await loadChildren(path);
      useRecentStore.getState().addRecentFolder(path);
    },
    [loadChildren],
  );

  const closeFolder = useCallback(() => {
    invoke("stop_watching").catch(() => {});
    setRootPath(null);
    setExpanded(new Set());
    setChildren(new Map());
    setBrowserError(null);
  }, []);

  const [collecting, setCollecting] = useState<Set<string>>(new Set());
  const collectVersionRef = useRef<Record<string, number>>({});

  // ── Multi-select (drag toggle & shift-click) ──
  const [isDragging, setIsDragging] = useState(false);
  const dragCheckRef = useRef(false);
  const didDragRef = useRef(false);
  const [lastClickedPath, setLastClickedPath] = useState<string | null>(null);

  function getVisibleFilePaths(): string[] {
    const paths: string[] = [];
    const walk = (dir: string) => {
      const entries = children.get(dir);
      if (!entries) return;
      for (const e of entries) {
        if (e.is_dir) {
          if (expanded.has(e.path)) walk(e.path);
        } else {
          paths.push(e.path);
        }
      }
    };
    if (rootPath) walk(rootPath);
    return paths;
  }

  function selectRange(from: string, to: string) {
    const paths = getVisibleFilePaths();
    const fi = paths.indexOf(from);
    const ti = paths.indexOf(to);
    if (fi === -1 || ti === -1) return;
    const [start, end] = fi <= ti ? [fi, ti] : [ti, fi];
    addFiles(paths.slice(start, end + 1));
  }

  function handleFileClick(path: string, shiftKey: boolean, ctrlKey: boolean) {
    if (shiftKey && lastClickedPath) {
      selectRange(lastClickedPath, path);
      return;
    }
    if (!ctrlKey) {
      setLastClickedPath(path);
    }
    handleFileCheck(path, !checkedPaths.has(path));
  }

  function handleFileDragStart(path: string) {
    const shouldCheck = checkedPaths.has(path);
    setIsDragging(true);
    dragCheckRef.current = shouldCheck;
    didDragRef.current = false;
    setLastClickedPath(path);
  }

  function handleFileDragOver(path: string) {
    if (!isDragging) return;
    didDragRef.current = true;
    if (dragCheckRef.current) {
      addFiles([path]);
    } else {
      removeFilesByPaths([path]);
    }
  }

  function handleFileDragEnd() {
    setIsDragging(false);
  }

  function handleFileRowClick(path: string) {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    handleFileCheck(path, !checkedPaths.has(path));
    setLastClickedPath(path);
  }

  function handleFileRowMouseDown(
    path: string,
    shiftKey: boolean,
    ctrlKey: boolean,
  ) {
    if (shiftKey) {
      didDragRef.current = true;
      handleFileClick(path, true, false);
    } else if (ctrlKey) {
      didDragRef.current = true;
      handleFileClick(path, false, true);
    } else {
      handleFileDragStart(path);
    }
  }

  useEffect(() => {
    if (!isDragging) return;
    const handler = () => setIsDragging(false);
    document.addEventListener("mouseup", handler);
    return () => document.removeEventListener("mouseup", handler);
  }, [isDragging]);

  async function openFolder() {
    const selected = await open({ directory: true, multiple: false });
    if (!selected) return;
    await navigateToFolder(selected as string);
  }

  async function toggleExpand(dir: string) {
    if (expanded.has(dir)) {
      const next = new Set(expanded);
      next.delete(dir);
      setExpanded(next);
    } else {
      const next = new Set(expanded);
      next.add(dir);
      setExpanded(next);
      if (!children.has(dir)) {
        await loadChildren(dir);
      }
    }
  }

  function isFullyChecked(dir: string): boolean {
    const dirChildren = children.get(dir);
    if (!dirChildren) return false;
    const fileChildren = dirChildren.filter((e) => !e.is_dir);
    if (fileChildren.length === 0) {
      return dirChildren
        .filter((e) => e.is_dir)
        .every((e) => isFullyChecked(e.path));
    }
    return (
      fileChildren.every((e) => checkedPaths.has(e.path)) &&
      dirChildren.filter((e) => e.is_dir).every((e) => isFullyChecked(e.path))
    );
  }

  function isPartiallyChecked(dir: string): boolean {
    const dirChildren = children.get(dir);
    if (!dirChildren) return false;
    return dirChildren.some((e) => {
      if (e.is_dir)
        return isPartiallyChecked(e.path) || isFullyChecked(e.path);
      return checkedPaths.has(e.path);
    });
  }

  async function handleFileCheck(path: string, checked: boolean) {
    if (checked) {
      addFiles([path]);
    } else {
      removeFilesByPaths([path]);
    }
  }

  async function handleFolderCheck(dir: string, checked: boolean) {
    const version = (collectVersionRef.current[dir] || 0) + 1;
    collectVersionRef.current[dir] = version;
    setCollecting((prev) => new Set(prev).add(dir));
    try {
      const allPaths = await collectAndLoad(dir);
      if (collectVersionRef.current[dir] !== version) return;
      if (checked) {
        addFiles(allPaths);
      } else {
        removeFilesByPaths(allPaths);
      }
    } catch (err) {
      if (collectVersionRef.current[dir] !== version) return;
      setBrowserError(`Failed to collect files: ${err}`);
    } finally {
      setCollecting((prev) => {
        const next = new Set(prev);
        next.delete(dir);
        return next;
      });
    }
  }

  async function handleFolderExpand(dir: string) {
    await toggleExpand(dir);
  }

  async function collectAndLoad(
    dir: string,
    visited: Set<string> = new Set(),
  ): Promise<string[]> {
    if (visited.has(dir)) return [];
    visited.add(dir);
    const entries = await listDirectory(dir).catch(() => [] as DirEntry[]);
    setChildren((prev) => new Map(prev).set(dir, entries));
    const files: string[] = [];
    const dirs: string[] = [];
    for (const e of entries) {
      if (e.is_dir) dirs.push(e.path);
      else files.push(e.path);
    }
    const sub = await Promise.all(dirs.map((d) => collectAndLoad(d, visited)));
    for (const sf of sub) files.push(...sf);
    return files;
  }

  function hasFilesRecursive(dirPath: string): boolean {
    const entries = children.get(dirPath);
    if (!entries) return false;
    for (const entry of entries) {
      if (!entry.is_dir) return true;
      if (hasFilesRecursive(entry.path)) return true;
    }
    return false;
  }

  function getAllLoadedFilePaths(): string[] {
    const paths = new Set<string>();
    const collect = (dir: string) => {
      const entries = children.get(dir);
      if (!entries) return;
      for (const e of entries) {
        if (e.is_dir) collect(e.path);
        else paths.add(e.path);
      }
    };
    if (rootPath) collect(rootPath);
    return [...paths];
  }

  const loadedPaths = getAllLoadedFilePaths();
  const allSelected =
    loadedPaths.length > 0 &&
    loadedPaths.every((p) => checkedPaths.has(p));

  function handleSelectAllToggle() {
    if (loadedPaths.length === 0) return;
    if (allSelected) {
      removeFilesByPaths(loadedPaths);
    } else {
      addFiles(loadedPaths);
    }
  }

  const rootChildren = children.get(rootPath ?? "");

  return {
    rootPath,
    browserError,
    expanded,
    children,
    loading,
    storeFiles,
    suggestions,
    generateStatus,
    updateSuggestion,
    recentFolders,
    removeRecentFolder,
    checkedPaths,
    filePathMap,
    hasAnySuggestions,
    rootChildren,
    allSelected,
    loadChildren,
    navigateToFolder,
    closeFolder,
    openFolder,
    toggleExpand,
    isFullyChecked,
    isPartiallyChecked,
    handleFileCheck,
    handleFolderCheck,
    handleFolderExpand,
    collecting,
    hasFilesRecursive,
    handleSelectAllToggle,
    isDragging,
    handleFileClick,
    handleFileDragStart,
    handleFileDragOver,
    handleFileDragEnd,
    handleFileRowClick,
    handleFileRowMouseDown,
  };
}
