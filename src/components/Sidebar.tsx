import type { View } from "../views";
import { useFileStore } from "../stores/fileStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useHistoryStore } from "../stores/historyStore";
import { useWorkflowStore } from "../stores/workflowStore";

type SidebarProps = {
  currentView: View;
  onNavigate: (view: View) => void;
};

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const files = useFileStore((s) => s.files);
  const settings = useSettingsStore();
  const historyEntries = useHistoryStore((s) => s.entries);
  const undoLastRename = useWorkflowStore((s) => s.undoLastRename);

  const navItems = [
    {
      view: "history" as const,
      label: "History",
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path d="M3 12a9 9 0 1 0 3-6.7M3 5v6h6M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      view: "settings" as const,
      label: "Settings",
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.16.35.42.65.75.84.24.13.51.2.78.2H21a2 2 0 1 1 0 4h-.08A1.7 1.7 0 0 0 19.4 15Z" />
        </svg>
      ),
    },
  ];

  const recentHistory = historyEntries.slice(0, 3);

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">R</div>
        <div className="brand-text">
          <h1>RenameFlow</h1>
          <p>AI-powered file renamer</p>
        </div>
      </div>

      <nav className="nav">
        <button
          className={`nav-item ${currentView === "home" ? "active" : ""}`}
          onClick={() => onNavigate("home")}
        >
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5Z" />
          </svg>
          <span>Home</span>
        </button>
        {navItems.map((item) => (
          <button
            key={item.view}
            className={`nav-item ${currentView === item.view ? "active" : ""}`}
            onClick={() => onNavigate(item.view)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {currentView === "home" && files.length > 0 && (
        <section className="panel rename-options">
          <h3>Rename Options</h3>
          <div>
            <div className="label">Language</div>
            <div className="select">
              <span>{settings.language === "english" ? "English" : settings.language === "vietnamese" ? "Vietnamese" : "Auto"}</span>
            </div>
          </div>
          <div>
            <div className="label">Format</div>
            <select
              className="format-select"
              value={settings.style}
              onChange={(e) => settings.updateSettings({ style: e.target.value as any })}
            >
              <option value="kebab-case">kebab-case</option>
              <option value="snake_case">snake_case</option>
              <option value="title-case">Title Case</option>
              <option value="camelCase">camelCase</option>
            </select>
          </div>
          <div>
            <div className="label">Max words</div>
            <input
              type="number"
              min={1}
              max={20}
              value={settings.maxWords}
              onChange={(e) => settings.updateSettings({ maxWords: parseInt(e.target.value) || 8 })}
              className="format-select"
            />
          </div>
        </section>
      )}

      {recentHistory.length > 0 && (
        <section className="panel history">
          <div className="history-head">
            <h3>Recent History</h3>
            <button onClick={() => onNavigate("history")}>View all</button>
          </div>
          {recentHistory.map((entry) => (
            <div key={entry.id} className="history-row">
              <div>
                {new Date(entry.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {" · "}
                {new Date(entry.createdAt).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
                <small>
                  {entry.successCount} file{entry.successCount !== 1 ? "s" : ""}
                </small>
              </div>
              <button className="undo" onClick={() => undoLastRename()}>Undo</button>
            </div>
          ))}
        </section>
      )}

      <div className="connection">
        <div>
          <strong><span className="green-dot"></span>Connected</strong>
          <small>{settings.activeModelId ? settings.activeModelId.replace("::", " · ") : "No model selected"}</small>
        </div>
        <button className="btn" style={{ width: "30px", padding: 0, justifyContent: "center" }}>⋮</button>
      </div>
    </aside>
  );
}
