import { useFileStore } from "../stores/fileStore";

export function FileList() {
  const files = useFileStore((s) => s.files);
  const removeFile = useFileStore((s) => s.removeFile);
  const selectedIds = useFileStore((s) => s.selectedIds);
  const toggleFile = useFileStore((s) => s.toggleFile);
  const selectAll = useFileStore((s) => s.selectAll);
  const deselectAll = useFileStore((s) => s.deselectAll);
  const clearAll = useFileStore((s) => s.clearAll);

  const allSelected = files.length > 0 && selectedIds.size === files.length;

  const statusLabel: Record<string, string> = {
    pending: "Pending",
    analyzing: "Analyzing...",
    ready: "Ready",
    renamed: "Renamed",
    failed: "Failed",
  };

  return (
    <div className="file-list">
      <div className="file-list-header">
        <h3 className="section-title">Files ({files.length})</h3>
        <div className="file-list-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => (allSelected ? deselectAll() : selectAll())}>
            {allSelected ? "Deselect All" : "Select All"}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={clearAll}>
            Clear All
          </button>
        </div>
      </div>
      <div className="file-table">
        <div className="file-table-header">
          <span className="file-col-check"></span>
          <span className="file-col-name">Name</span>
          <span className="file-col-status">Status</span>
          <span className="file-col-action"></span>
        </div>
        {files.map((file) => (
          <div key={file.id} className="file-row">
            <span className="file-col-check">
              <input
                type="checkbox"
                checked={selectedIds.has(file.id)}
                onChange={() => toggleFile(file.id)}
              />
            </span>
            <span className="file-col-name" title={file.path}>
              {file.originalName}{file.extension}
            </span>
            <span className="file-col-status">
              <span className={`status-badge status-${file.status}`}>
                {statusLabel[file.status] || file.status}
              </span>
            </span>
            <span className="file-col-action">
              <button
                className="btn-icon"
                onClick={() => removeFile(file.id)}
                title="Remove"
              >
                ✕
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
