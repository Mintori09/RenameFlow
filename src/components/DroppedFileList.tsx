import { useFileStore } from "../stores/fileStore";
import { useWorkflowStore } from "../stores/workflowStore";
import { getFileIcon } from "../utils/fileIcon";

function hasImageFiles(files: { path: string }[]): boolean {
  return files.some((f) =>
    /\.(jpe?g|png|gif|bmp|webp|tiff?|ico|heic|heif|avif)$/i.test(f.path),
  );
}

export function DroppedFileList() {
  const files = useFileStore((s) => s.files);
  const suggestions = useFileStore((s) => s.suggestions);
  const generateStatus = useFileStore((s) => s.generateStatus);
  const removeFilesByPaths = useFileStore((s) => s.removeFilesByPaths);
  const updateSuggestion = useFileStore((s) => s.updateSuggestion);
  const clearAll = useFileStore((s) => s.clearAll);
  const undoFileRename = useWorkflowStore((s) => s.undoFileRename);

  if (files.length === 0) return null;

  const hasSuggestions = Object.keys(suggestions).length > 0;
  const showVisionWarning = hasImageFiles(files);
  const renamedCount = files.filter((f) => f.oldPath).length;

  return (
    <>
      {showVisionWarning && (
        <div className="vision-warning-banner">
          The list contains image files. Best names come from vision-capable
          models (GPT-4o, Claude 3, Gemini) in Settings.
        </div>
      )}
      <div className="dropped-file-list">
      <div className="dropped-file-list-header">
        <span className="dropped-file-list-title">
          Dropped Files ({files.length})
        </span>
        {renamedCount > 0 && (
          <span className="rename-counter">{renamedCount}/{files.length} renamed</span>
        )}
        <button className="btn btn-sm dropped-clear-btn" onClick={clearAll}>
          Clear
        </button>
      </div>
      <div className="dropped-file-list-body">
        {files.map((file) => {
          const suggestion = suggestions[file.id];
          const newName = file.originalName + file.extension;
          const oldName = file.oldPath
            ? file.oldPath.replace(/\\/g, "/").split("/").pop() || ""
            : "";
          const isRenamed = !!file.oldPath;

          return (
            <div
              key={file.id}
              className={`tree-row dropped-file-row${isRenamed ? " renamed-flash" : ""}`}
            >
              <input
                type="checkbox"
                className="table-checkbox"
                checked={true}
                onChange={() => removeFilesByPaths([file.path])}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="tree-file-icon">{getFileIcon(newName)}</span>
              {isRenamed ? (
                <span className="tree-label" title={file.oldPath}>
                  <span className="old-name">{oldName}</span>
                  <span className="rename-arrow">&rarr;</span>
                  {newName}
                </span>
              ) : (
                <span className="tree-label" title={file.path}>
                  {newName}
                </span>
              )}
              {isRenamed ? (
                <span className="status-pill renamed">Renamed &#10003;</span>
              ) : file.status === "renaming" ? (
                <span className="file-spinner" />
              ) : file.status === "failed" ? (
                <span className="status-pill failed">
                  Failed{file.error ? `: ${file.error}` : ""}
                </span>
              ) : null}
              {suggestion && !isRenamed ? (
                <input
                  className="suggestion-input"
                  value={suggestion.finalName}
                  onChange={(e) =>
                    updateSuggestion(file.id, e.target.value)
                  }
                  onClick={(e) => e.stopPropagation()}
                />
              ) : !isRenamed && file.status !== "failed" && generateStatus === "generating" ? (
                <span className="file-spinner" />
              ) : !isRenamed && hasSuggestions && file.status === "pending" ? (
                <span className="suggestion-empty" />
              ) : null}
              {isRenamed ? (
                <button
                  className="undo-btn"
                  onClick={() => undoFileRename(file.id)}
                  title="Undo rename"
                >
                  &#8634;
                </button>
              ) : file.status === "renaming" ? null : (
                <button
                  className="dropped-file-remove"
                  onClick={() => removeFilesByPaths([file.path])}
                  title="Remove"
                >
                  &times;
                </button>
              )}
            </div>
          );
        })}
      </div>
      </div>
    </>
  );
}
