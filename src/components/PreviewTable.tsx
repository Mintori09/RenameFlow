import { useFileStore } from "../stores/fileStore";

type PreviewTableProps = {
  onRename: () => void;
  onRegenerateFile: (fileId: string) => void;
  regeneratingIds: Set<string>;
};

export function PreviewTable({ onRename, onRegenerateFile, regeneratingIds }: PreviewTableProps) {
  const files = useFileStore((s) => s.files);
  const suggestions = useFileStore((s) => s.suggestions);
  const selectedIds = useFileStore((s) => s.selectedIds);
  const updateSuggestion = useFileStore((s) => s.updateSuggestion);
  const toggleFile = useFileStore((s) => s.toggleFile);
  const deselectAll = useFileStore((s) => s.deselectAll);

  const previewItems = files
    .filter((f) => suggestions[f.id])
    .map((f) => ({
      file: f,
      suggestion: suggestions[f.id],
    }));

  if (previewItems.length === 0) return null;

  const selectedCount = [...selectedIds].filter((id) => suggestions[id]).length;

  return (
    <div className="preview-table">
      <div className="preview-header">
        <h3 className="section-title">
          Preview ({previewItems.length} files)
        </h3>
        <div className="preview-actions">
          <button className="btn btn-secondary btn-sm" onClick={deselectAll}>
            Deselect All
          </button>
          <button
            className="btn btn-primary"
            onClick={onRename}
            disabled={selectedCount === 0}
          >
            Rename Selected ({selectedCount})
          </button>
        </div>
      </div>
      <div className="preview-grid">
        <div className="preview-grid-header">
          <span className="preview-col-check"></span>
          <span className="preview-col-current">Current Name</span>
          <span className="preview-col-new">New Name</span>
          <span className="preview-col-status">Status</span>
          <span className="preview-col-action"></span>
        </div>
        {previewItems.map(({ file, suggestion }) => (
          <div key={file.id} className="preview-row">
            <span className="preview-col-check">
              <input
                type="checkbox"
                checked={selectedIds.has(file.id)}
                onChange={() => toggleFile(file.id)}
              />
            </span>
            <span className="preview-col-current" title={file.path}>
              {file.originalName}{file.extension}
            </span>
            <span className="preview-col-new">
              <input
                className="preview-input"
                type="text"
                value={suggestion.finalName}
                onChange={(e) => updateSuggestion(file.id, e.target.value)}
              />
            </span>
            <span className="preview-col-status">
              <span className={`status-badge status-${file.status}`}>
                {file.status === "ready" || file.status === "pending"
                  ? "Ready"
                  : file.status}
              </span>
            </span>
            <span className="preview-col-action">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onRegenerateFile(file.id)}
                disabled={regeneratingIds.has(file.id)}
              >
                {regeneratingIds.has(file.id) ? "..." : "Regenerate"}
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
