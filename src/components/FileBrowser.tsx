import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useFileStore } from "../stores/fileStore";
import type { DirEntry } from "../types";

async function collectAllFiles(dir: string): Promise<string[]> {
  const entries = await invoke<DirEntry[]>("list_directory", { path: dir });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.is_dir) {
      const sub = await collectAllFiles(entry.path);
      files.push(...sub);
    } else {
      files.push(entry.path);
    }
  }
  return files;
}

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const iconMap: Record<string, string> = {
    jpg: "🖼️",
    jpeg: "🖼️",
    png: "🖼️",
    gif: "🖼️",
    svg: "🖼️",
    webp: "🖼️",
    bmp: "🖼️",
    ico: "🖼️",
    mp4: "🎬",
    avi: "🎬",
    mkv: "🎬",
    mov: "🎬",
    wmv: "🎬",
    flv: "🎬",
    webm: "🎬",
    mp3: "🎵",
    wav: "🎵",
    ogg: "🎵",
    flac: "🎵",
    aac: "🎵",
    m4a: "🎵",
    wma: "🎵",
    ts: "🔵",
    tsx: "🔵",
    js: "🟡",
    jsx: "🟡",
    py: "🐍",
    rs: "🦀",
    go: "🔷",
    java: "☕",
    c: "⚙️",
    cpp: "⚙️",
    h: "⚙️",
    cs: "⚙️",
    css: "🎨",
    html: "🌐",
    xml: "📋",
    json: "📋",
    yaml: "📋",
    yml: "📋",
    toml: "📋",
    sh: "💻",
    bash: "💻",
    zsh: "💻",
    fish: "💻",
    pdf: "📕",
    doc: "📘",
    docx: "📘",
    xls: "📗",
    xlsx: "📗",
    ppt: "📙",
    pptx: "📙",
    txt: "📄",
    md: "📝",
    rtf: "📄",
    log: "📄",
    csv: "📊",
    zip: "📦",
    tar: "📦",
    gz: "📦",
    bz2: "📦",
    rar: "📦",
    "7z": "📦",
    db: "🗄️",
    sqlite: "🗄️",
    sql: "🗄️",
    exe: "⚡",
    dmg: "⚡",
    appimage: "⚡",
    deb: "⚡",
    rpm: "⚡",
    dll: "🔧",
    so: "🔧",
    dylib: "🔧",
    lock: "🔒",
    env: "🔒",
    pem: "🔒",
    key: "🔒",
    pfx: "🔒",
    torrent: "🧲",
    iso: "💿",
    img: "💿",
    psd: "🎨",
    ai: "🎨",
    fig: "🎨",
    sketch: "🎨",
    ttf: "🔤",
    otf: "🔤",
    woff: "🔤",
    woff2: "🔤",
    eot: "🔤",
  };
  return iconMap[ext] || "📄";
}

function FolderCheckbox({
  fullyChecked,
  partiallyChecked,
  onChange,
}: {
  fullyChecked: boolean;
  partiallyChecked: boolean;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = !fullyChecked && partiallyChecked;
    }
  }, [fullyChecked, partiallyChecked]);

  return (
    <input
      type="checkbox"
      className="table-checkbox"
      checked={fullyChecked}
      ref={ref}
      onChange={onChange}
    />
  );
}

export function FileBrowser() {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [children, setChildren] = useState<Map<string, DirEntry[]>>(new Map());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [browserError, setBrowserError] = useState<string | null>(null);

  const storeFiles = useFileStore((s) => s.files);
  const suggestions = useFileStore((s) => s.suggestions);
  const addFiles = useFileStore((s) => s.addFiles);
  const removeFilesByPaths = useFileStore((s) => s.removeFilesByPaths);
  const updateSuggestion = useFileStore((s) => s.updateSuggestion);

  const hasAnySuggestions = Object.keys(suggestions).length > 0;

  const checkedPaths = new Set(storeFiles.map((f) => f.path));

  const loadChildren = useCallback(
    async (dir: string) => {
      if (children.has(dir)) return;
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
    },
    [children],
  );

  async function openFolder() {
    const selected = await open({ directory: true, multiple: false });
    if (!selected) return;
    const path = selected as string;
    setRootPath(path);
    setExpanded(new Set([path]));
    setChildren(new Map());
    await loadChildren(path);
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
      if (e.is_dir) return isPartiallyChecked(e.path) || isFullyChecked(e.path);
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
    const allPaths = await collectAllFiles(dir);
    if (checked) {
      addFiles(allPaths);
    } else {
      removeFilesByPaths(allPaths);
    }
  }

  function renderEntry(entry: DirEntry, depth: number) {
    if (entry.is_dir) {
      const isExpanded = expanded.has(entry.path);
      const dirChildren = children.get(entry.path);
      const isLoading = loading.has(entry.path);
      const fullyChecked = isFullyChecked(entry.path);
      const partiallyChecked = isPartiallyChecked(entry.path);

      return (
        <div key={entry.path}>
          <div
            className="tree-row"
            style={{ paddingLeft: `${depth * 20 + 8}px` }}
          >
            <button
              className="tree-expand"
              onClick={() => toggleExpand(entry.path)}
            >
              {isLoading ? "⋯" : isExpanded ? "▾" : "▸"}
            </button>
            <span className="folder-icon" />
            <span className="tree-label">{entry.name}</span>
            <FolderCheckbox
              fullyChecked={fullyChecked}
              partiallyChecked={partiallyChecked}
              onChange={() => handleFolderCheck(entry.path, !fullyChecked)}
            />
          </div>
          {isExpanded && dirChildren && dirChildren.length > 0 && (
            <div>
              {dirChildren.map((child) => renderEntry(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    const fileItem = storeFiles.find((f) => f.path === entry.path);
    const suggestion = fileItem ? suggestions[fileItem.id] : undefined;

    return (
      <div
        key={entry.path}
        className="tree-row"
        style={{ paddingLeft: `${depth * 20 + 28}px` }}
      >
        <span className="tree-file-icon">{getFileIcon(entry.name)}</span>
        <span className="tree-label">{entry.name}</span>
        {hasAnySuggestions && (
          suggestion ? (
            <input
              className="suggestion-input"
              value={suggestion.finalName}
              onChange={(e) => updateSuggestion(fileItem!.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="suggestion-empty" />
          )
        )}
        <input
          type="checkbox"
          className="table-checkbox"
          checked={checkedPaths.has(entry.path)}
          onChange={() =>
            handleFileCheck(entry.path, !checkedPaths.has(entry.path))
          }
        />
      </div>
    );
  }

  if (!rootPath) {
    return (
      <div className="browser-empty">
        <button className="open-folder-btn" onClick={openFolder}>
          Open Folder
        </button>
        <p className="browser-hint">
          Browse your files and select files to rename
        </p>
      </div>
    );
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
  const allSelected = loadedPaths.length > 0 && loadedPaths.every((p) => checkedPaths.has(p));

  function handleSelectAllToggle() {
    if (loadedPaths.length === 0) return;
    if (allSelected) {
      removeFilesByPaths(loadedPaths);
    } else {
      addFiles(loadedPaths);
    }
  }

  const rootChildren = children.get(rootPath);

  return (
    <div className="file-browser">
      <div className="browser-header">
        <span className="browser-root" title={rootPath}>
          {rootPath}
        </span>
        <div className="browser-actions">
          <button className="btn btn-sm" onClick={handleSelectAllToggle}>
            {allSelected ? "Deselect All" : "Select All"}
          </button>
          <button className="btn btn-sm" onClick={openFolder}>
            Browse
          </button>
        </div>
      </div>
      <div className="browser-body">
        {browserError && (
          <div
            className="browser-empty-msg"
            style={{ color: "var(--color-error)" }}
          >
            {browserError}
          </div>
        )}
        {rootChildren && rootChildren.length > 0 ? (
          rootChildren.map((entry) => renderEntry(entry, 0))
        ) : (
          <div className="browser-empty-msg">
            {rootChildren ? "Empty folder" : "Loading..."}
          </div>
        )}
      </div>
    </div>
  );
}
