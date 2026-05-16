import { useState } from "react";
import { useHistoryStore } from "../stores/historyStore";
import { useWorkflowStore } from "../stores/workflowStore";
import { undoHistoryEntry } from "../services/historyService";

export function HistorySection() {
  const entries = useHistoryStore((s) => s.entries);
  const loadHistory = useWorkflowStore((s) => s.loadHistory);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  const handleUndo = async (id: string) => {
    setUndoingId(id);
    try {
      const result = await undoHistoryEntry(id);
      if (result.restored > 0) {
        loadHistory();
      }
    } catch (err) {
      console.error("Undo failed:", err);
    } finally {
      setUndoingId(null);
    }
  };

  return (
    <div className="section">
      <h2>History</h2>
      {entries.length === 0 ? (
        <p className="empty-state">No rename history yet.</p>
      ) : (
        <div className="history-list">
          {entries.map((entry) => (
            <div key={entry.id} className="history-item">
              <span>{entry.createdAt}</span>
              <span>{entry.successCount} renamed</span>
              {entry.failedCount > 0 && <span>{entry.failedCount} failed</span>}
              <button
                className="btn btn-sm"
                onClick={() => handleUndo(entry.id)}
                disabled={undoingId === entry.id}
              >
                {undoingId === entry.id ? "Undoing..." : "Undo"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
