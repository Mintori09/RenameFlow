import { useFileStore } from "../stores/fileStore";
import { getFileIcon } from "../utils/fileIcon";

export function DroppedFileList() {
  const files = useFileStore((s) => s.files);
  const suggestions = useFileStore((s) => s.suggestions);
  const generateStatus = useFileStore((s) => s.generateStatus);
  const removeFilesByPaths = useFileStore((s) => s.removeFilesByPaths);
  const updateSuggestion = useFileStore((s) => s.updateSuggestion);
  const clearAll = useFileStore((s) => s.clearAll);

  if (files.length === 0) return null;

  const hasSuggestions = Object.keys(suggestions).length > 0;

  return (
    <div className="dropped-file-list">
      <div className="dropped-file-list-header">
        <span className="dropped-file-list-title">
          Dropped Files ({files.length})
        </span>
        <button className="btn btn-sm dropped-clear-btn" onClick={clearAll}>
          Clear
        </button>
      </div>
      <div className="dropped-file-list-body">
        {files.map((file) => {
          const suggestion = suggestions[file.id];
          const fullName = file.originalName + file.extension;

          return (
            <div key={file.id} className="tree-row dropped-file-row">
              <input
                type="checkbox"
                className="table-checkbox"
                checked={true}
                onChange={() => removeFilesByPaths([file.path])}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="tree-file-icon">{getFileIcon(fullName)}</span>
              <span className="tree-label" title={file.path}>
                {fullName}
              </span>
              {file.status !== "pending" && (
                <span className={`status-pill ${file.status}`}>
                  {file.status === "renaming"
                    ? "Renaming..."
                    : file.status === "renamed"
                      ? "Renamed"
                      : file.status === "failed"
                        ? `Failed${file.error ? `: ${file.error}` : ""}`
                        : file.status}
                </span>
              )}
              {suggestion ? (
                <input
                  className="suggestion-input"
                  value={suggestion.finalName}
                  onChange={(e) =>
                    updateSuggestion(file.id, e.target.value)
                  }
                  onClick={(e) => e.stopPropagation()}
                />
              ) : generateStatus === "generating" ? (
                <span className="file-spinner" />
              ) : hasSuggestions && file.status === "pending" ? (
                <span className="suggestion-empty" />
              ) : null}
              <button
                className="dropped-file-remove"
                onClick={() => removeFilesByPaths([file.path])}
                title="Remove"
              >
                &times;
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
