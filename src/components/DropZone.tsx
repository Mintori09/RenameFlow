import { useCallback, useRef, useState, useEffect } from "react";

type DropZoneProps = {
  onFilesSelected: (paths: string[]) => void;
};

export function DropZone({ onFilesSelected }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (folderInputRef.current) {
      (folderInputRef.current as any).webkitdirectory = "";
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      const paths = files.map((f) => (f as any).path).filter(Boolean);
      if (paths.length > 0) onFilesSelected(paths);
    },
    [onFilesSelected]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleFilePick = () => fileInputRef.current?.click();
  const handleFolderPick = () => folderInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const paths = files.map((f) => (f as any).path).filter(Boolean);
    if (paths.length > 0) onFilesSelected(paths);
    e.target.value = "";
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const paths = files.map((f) => (f as any).path).filter(Boolean);
    if (paths.length > 0) onFilesSelected(paths);
    e.target.value = "";
  };

  return (
    <div
      className={`dropzone ${dragging ? "dropzone-active" : ""}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="dropzone-content">
        <p className="dropzone-text">Drop files here</p>
        <div className="dropzone-actions">
          <button className="btn btn-secondary" onClick={handleFilePick}>
            Choose Files
          </button>
          <button className="btn btn-secondary" onClick={handleFolderPick}>
            Choose Folder
          </button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={handleFolderChange}
      />
    </div>
  );
}
