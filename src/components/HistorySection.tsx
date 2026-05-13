import { useHistoryStore } from "../stores/historyStore";

export function HistorySection() {
  const entries = useHistoryStore((s) => s.entries);

  return (
    <div className="section">
      <h2 className="section-title">History</h2>
      {entries.length === 0 ? (
        <p className="empty-state">No rename history yet.</p>
      ) : (
        <div className="history-list">
          {entries.map((entry) => (
            <div key={entry.id} className="history-item">
              <span>{entry.createdAt}</span>
              <span>{entry.successCount} renamed</span>
              {entry.failedCount > 0 && (
                <span className="status-failed">{entry.failedCount} failed</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
