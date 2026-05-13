import { useFileStore } from "../stores/fileStore";

type PreviewTableProps = {
  onRegenerateFile: (fileId: string) => void;
  regeneratingIds: Set<string>;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function getThumbnailContent(file: {
  mimeType?: string;
  originalName: string;
  extension: string;
}) {
  const isVideo =
    file.mimeType?.startsWith("video/") ||
    /\.(mp4|mov|avi|mkv)$/i.test(file.extension);
  const isImage =
    file.mimeType?.startsWith("image/") ||
    /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file.extension);

  if (isImage) {
    return <div className="thumb">🖼</div>;
  }
  if (isVideo) {
    return (
      <div className="thumb">
        🎬
        <span className="play-overlay">▶</span>
      </div>
    );
  }
  const ext = file.extension.toLowerCase();
  if (ext === ".pdf") return <div className="thumb">📄</div>;
  if (ext === ".docx" || ext === ".doc") return <div className="thumb">📝</div>;
  if (ext === ".xlsx" || ext === ".xls") return <div className="thumb">📗</div>;
  return <div className="thumb">📁</div>;
}

export function PreviewTable({
  onRegenerateFile,
  regeneratingIds,
}: PreviewTableProps) {
  const files = useFileStore((s) => s.files);
  const suggestions = useFileStore((s) => s.suggestions);
  const selectedIds = useFileStore((s) => s.selectedIds);
  const updateSuggestion = useFileStore((s) => s.updateSuggestion);
  const toggleFile = useFileStore((s) => s.toggleFile);

  const previewItems = Object.values(suggestions).map((suggestion) => {
    const file = files.find((f) => f.id === suggestion.fileId);
    return {
      file: file ?? {
        id: suggestion.fileId,
        path: "",
        directory: "",
        originalName: suggestion.originalName,
        extension: "",
        size: 0,
        status: "pending" as const,
      },
      suggestion,
    };
  });

  if (previewItems.length === 0) return null;

  const selectedCount = [...selectedIds].filter((id) => suggestions[id]).length;

  return (
    <div className="table-card">
      <table className="file-table">
        <thead>
          <tr>
            <th></th>
            <th>Preview</th>
            <th>Current Name</th>
            <th>Suggested Name</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {previewItems.map(({ file, suggestion }) => (
            <tr key={file.id}>
              <td>
                <input
                  type="checkbox"
                  className="table-checkbox"
                  checked={selectedIds.has(file.id)}
                  onChange={() => toggleFile(file.id)}
                />
              </td>
              <td>{getThumbnailContent(file)}</td>
              <td>
                <div
                  className="file-name"
                  title={file.originalName + file.extension}
                >
                  {file.originalName}
                  {file.extension}
                </div>
                <div className="file-size">{formatBytes(file.size)}</div>
              </td>
              <td>
                <input
                  className="suggested"
                  type="text"
                  value={suggestion.finalName}
                  onChange={(e) => updateSuggestion(file.id, e.target.value)}
                />
              </td>
              <td>
                <span
                  className={`status-pill ${file.status === "pending" ? "pending" : file.status === "failed" ? "failed" : file.status === "renamed" ? "skipped" : ""}`}
                >
                  {file.status === "ready" || file.status === "pending"
                    ? "Ready"
                    : file.status === "renamed"
                      ? "Renamed"
                      : file.status === "failed"
                        ? "Failed"
                        : file.status}
                </span>
              </td>
              <td>
                <div className="actions-cell">
                  <button
                    onClick={() => onRegenerateFile(file.id)}
                    disabled={regeneratingIds.has(file.id)}
                    title="Regenerate"
                  >
                    {regeneratingIds.has(file.id) ? "⏳" : "⟳"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="footer-row">
        <div className="footer-left">
          <span>
            {selectedCount} of {previewItems.length} files selected
          </span>
          <span>
            {formatBytes(files.reduce((sum, f) => sum + f.size, 0))} total
          </span>
        </div>
        <div className="footer-right">
          <button
            className="clear-btn"
            onClick={() => useFileStore.getState().clearAll()}
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
}
