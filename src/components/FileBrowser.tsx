import { memo } from "react";
import { useFileBrowser } from "../hooks/useFileBrowser";
import { useFileStore } from "../stores/fileStore";
import { FolderCheckbox } from "./FolderCheckbox";
import { DroppedFileList } from "./DroppedFileList";
import { getFileIcon } from "../utils/fileIcon";
import type { DirEntry, ResolvedPath } from "../types";

type FileBrowserProps = {
  cliPath?: ResolvedPath | null;
};

export function FileBrowser({ cliPath = null }: FileBrowserProps) {
  const b = useFileBrowser(cliPath);
  const clearAll = useFileStore((s) => s.clearAll);

  if (!b.rootPath) {
    if (b.storeFiles.length > 0) {
      return <DroppedFileList />;
    }
    return (
        <div className="browser-empty">
          <button className="open-folder-btn" onClick={b.openFolder}>
            Open Folder
          </button>
          <p className="browser-hint">
            Browse your files and select files to rename
          </p>
          {b.recentFolders.length > 0 && (
            <div className="recent-empty-list">
              <span className="recent-empty-label">Recent folders:</span>
              {b.recentFolders.map((f) => (
                <button
                  key={f.path}
                  className="recent-chip"
                  onClick={() => b.navigateToFolder(f.path)}
                  title={f.path}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
      );
  }

  return (
    <>
      <div className="file-browser">
        <div className="browser-header">
          <span className="browser-root" title={b.rootPath}>
            {b.rootPath}
          </span>
          <div className="browser-actions">
            <button className="btn btn-sm" onClick={b.handleSelectAllToggle}>
              {b.allSelected ? "Deselect All" : "Select All"}
            </button>
            <button
              className="btn btn-sm"
              onClick={() => {
                clearAll();
                b.closeFolder();
              }}
            >
              Clear
            </button>
            <button className="btn btn-sm" onClick={b.openFolder}>
              Browse
            </button>
          </div>
        </div>

        {b.recentFolders.length > 0 && (
          <div className="recent-bar">
            <span className="recent-bar-label">Recent:</span>
            <div className="recent-bar-list">
              {b.recentFolders.map((f) => (
                <div key={f.path} className="recent-bar-item">
                  <button
                    className="recent-chip"
                    onClick={() => b.navigateToFolder(f.path)}
                    title={f.path}
                  >
                    {f.label}
                  </button>
                  <button
                    className="recent-chip-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      b.removeRecentFolder(f.path);
                    }}
                    title="Remove from recent"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {b.storeFiles.some((f) =>
          /\.(jpe?g|png|gif|bmp|webp|tiff?|ico|heic|heif|avif)$/i.test(f.path),
        ) && (
          <div className="vision-warning-banner">
            The list contains image files. Best names come from vision-capable
            models (GPT-4o, Claude 3, Gemini) in Settings.
          </div>
        )}

        <div className="browser-body">
          {b.browserError && (
            <div
              className="browser-empty-msg"
              style={{ color: "var(--color-error)" }}
            >
              {b.browserError}
            </div>
          )}
          {b.rootChildren && b.rootChildren.length > 0 ? (
            b.rootChildren.map((entry) => (
              <TreeNode
                key={entry.path}
                entry={entry}
                depth={0}
                filePathMap={b.filePathMap}
                expanded={b.expanded}
                childrenMap={b.children}
                loading={b.loading}
                suggestions={b.suggestions}
                generateStatus={b.generateStatus}
                storeFiles={b.storeFiles}
                checkedPaths={b.checkedPaths}
                hasAnySuggestions={b.hasAnySuggestions}
                toggleExpand={b.toggleExpand}
                isFullyChecked={b.isFullyChecked}
                isPartiallyChecked={b.isPartiallyChecked}
                hasFilesRecursive={b.hasFilesRecursive}
                handleFolderCheck={b.handleFolderCheck}
                handleFolderExpand={b.handleFolderExpand}
                collecting={b.collecting}
                updateSuggestion={b.updateSuggestion}
                handleFileCheck={b.handleFileCheck}
                isDragging={b.isDragging}
                handleFileClick={b.handleFileClick}
                handleFileDragStart={b.handleFileDragStart}
                handleFileDragOver={b.handleFileDragOver}
                handleFileDragEnd={b.handleFileDragEnd}
                handleFileRowClick={b.handleFileRowClick}
                handleFileRowMouseDown={b.handleFileRowMouseDown}
              />
            ))
          ) : (
            <div className="browser-empty-msg">
              {b.rootChildren ? "Empty folder" : "Loading..."}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

type TreeNodeProps = {
  entry: DirEntry;
  depth: number;
  filePathMap: Map<string, string>;
  expanded: Set<string>;
  childrenMap: Map<string, DirEntry[]>;
  loading: Set<string>;
  suggestions: Record<string, { finalName: string }>;
  storeFiles: Array<{ id: string; status: string; error?: string }>;
  checkedPaths: Set<string>;
  generateStatus: "idle" | "generating" | "ready" | "error";
  hasAnySuggestions: boolean;
  toggleExpand: (dir: string) => Promise<void>;
  isFullyChecked: (dir: string) => boolean;
  isPartiallyChecked: (dir: string) => boolean;
  hasFilesRecursive: (dir: string) => boolean;
  handleFolderCheck: (dir: string, checked: boolean) => Promise<void>;
  handleFolderExpand: (dir: string) => Promise<void>;
  collecting: Set<string>;
  updateSuggestion: (fileId: string, newName: string) => void;
  handleFileCheck: (path: string, checked: boolean) => Promise<void>;
  isDragging: boolean;
  handleFileClick: (path: string, shiftKey: boolean, ctrlKey: boolean) => void;
  handleFileDragStart: (path: string) => void;
  handleFileDragOver: (path: string) => void;
  handleFileDragEnd: () => void;
  handleFileRowClick: (path: string) => void;
  handleFileRowMouseDown: (path: string, shiftKey: boolean, ctrlKey: boolean) => void;
};

const TreeNode = memo(function TreeNode({
  entry,
  depth,
  filePathMap,
  expanded,
  childrenMap,
  loading,
  suggestions,
  storeFiles,
  checkedPaths,
  generateStatus,
  hasAnySuggestions,
  toggleExpand,
  isFullyChecked,
  isPartiallyChecked,
  hasFilesRecursive,
  handleFolderCheck,
  handleFolderExpand,
  collecting,
  updateSuggestion,
  handleFileCheck,
  isDragging,
  handleFileClick,
  handleFileDragStart,
  handleFileDragOver,
  handleFileDragEnd,
  handleFileRowClick,
  handleFileRowMouseDown,
}: TreeNodeProps) {
  if (entry.is_dir) {
    const isExpanded = expanded.has(entry.path);
    const dirChildren = childrenMap.get(entry.path);
    const isLoading = loading.has(entry.path);
    const fullyChecked = isFullyChecked(entry.path);
    const partiallyChecked = isPartiallyChecked(entry.path);
    const hasFiles = dirChildren ? hasFilesRecursive(entry.path) : true;
    const visibleChildren = dirChildren;

    return (
      <div>
        <div
          className="tree-row"
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={async () => {
            await handleFolderExpand(entry.path);
          }}
        >
          <button
            className="tree-expand"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(entry.path);
            }}
          >
            {isLoading ? "⋯" : isExpanded ? "▾" : "▸"}
          </button>
          <span onClick={(e) => e.stopPropagation()}>
            {hasFiles && (
              <FolderCheckbox
                fullyChecked={fullyChecked}
                partiallyChecked={partiallyChecked}
                loading={collecting.has(entry.path)}
                onChange={async () => {
                  await handleFolderCheck(entry.path, !fullyChecked);
                }}
              />
            )}
          </span>
          <span className="folder-icon" />
          <span className="tree-label">{entry.name}</span>
        </div>
        {isExpanded &&
          (visibleChildren && visibleChildren.length > 0 ? (
            <div>
              {visibleChildren.map((child) => (
                <TreeNode
                  key={child.path}
                  entry={child}
                  depth={depth + 1}
                  filePathMap={filePathMap}
                  expanded={expanded}
                  childrenMap={childrenMap}
                  loading={loading}
                  suggestions={suggestions}
                  storeFiles={storeFiles}
                  checkedPaths={checkedPaths}
                  generateStatus={generateStatus}
                  hasAnySuggestions={hasAnySuggestions}
                  toggleExpand={toggleExpand}
                  isFullyChecked={isFullyChecked}
                  isPartiallyChecked={isPartiallyChecked}
                  hasFilesRecursive={hasFilesRecursive}
                  handleFolderCheck={handleFolderCheck}
                  handleFolderExpand={handleFolderExpand}
                  collecting={collecting}
                  updateSuggestion={updateSuggestion}
                  handleFileCheck={handleFileCheck}
                  isDragging={isDragging}
                  handleFileClick={handleFileClick}
                  handleFileDragStart={handleFileDragStart}
                  handleFileDragOver={handleFileDragOver}
                  handleFileDragEnd={handleFileDragEnd}
                  handleFileRowClick={handleFileRowClick}
                  handleFileRowMouseDown={handleFileRowMouseDown}
                />
              ))}
            </div>
          ) : isLoading ? (
            <div
              style={{ paddingLeft: `${(depth + 1) * 20 + 8}px` }}
            >
              Loading...
            </div>
          ) : null)}
      </div>
    );
  }

  const fileId = filePathMap.get(entry.path);
  const suggestion = fileId ? suggestions[fileId] : undefined;
  const fileEntry = fileId ? storeFiles.find((f) => f.id === fileId) : undefined;

  return (
    <div
      className="tree-row"
      style={{ paddingLeft: `${depth * 20 + 28}px` }}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        handleFileRowMouseDown(entry.path, e.shiftKey, e.ctrlKey || e.metaKey);
      }}
      onMouseEnter={() => {
        handleFileDragOver(entry.path);
      }}
      onClick={() => {
        handleFileRowClick(entry.path);
      }}
    >
      <input
        type="checkbox"
        className="table-checkbox"
        checked={checkedPaths.has(entry.path)}
        onChange={() =>
          handleFileCheck(entry.path, !checkedPaths.has(entry.path))
        }
        onClick={(e) => e.stopPropagation()}
      />
      <span className="tree-file-icon">{getFileIcon(entry.name)}</span>
      <span className="tree-label">{entry.name}</span>
      {fileEntry && fileEntry.status !== "pending" && (
        <span className={`status-pill ${fileEntry.status}`}>
          {fileEntry.status === "renaming"
            ? "Renaming..."
            : fileEntry.status === "renamed"
              ? "Renamed"
              : fileEntry.status === "failed"
                ? `Failed${fileEntry.error ? `: ${fileEntry.error}` : ""}`
                : fileEntry.status}
        </span>
      )}
      {suggestion ? (
        <input
          className="suggestion-input"
          value={suggestion.finalName}
          onChange={(e) =>
            updateSuggestion(fileId!, e.target.value)
          }
          onClick={(e) => e.stopPropagation()}
        />
      ) : generateStatus === "generating" && checkedPaths.has(entry.path) ? (
        <span className="file-spinner" />
      ) : hasAnySuggestions && (!fileEntry || fileEntry.status === "pending") ? (
        <span className="suggestion-empty" />
      ) : null}
    </div>
  );
});
