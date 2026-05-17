import type { DragState } from "../hooks/useFileDrop";

type Props = {
  dragState: DragState;
};

export function DragDropOverlay({ dragState }: Props) {
  if (dragState === "idle") return null;

  return (
    <div className="drag-overlay">
      <div className="drag-overlay-card">
        <span className="drag-overlay-icon">📂</span>
        <span className="drag-overlay-text">
          Drop files or folders here
        </span>
      </div>
    </div>
  );
}
