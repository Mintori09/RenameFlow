import type { View } from "../views";

type SidebarProps = {
  currentView: View;
  onNavigate: (view: View) => void;
};

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const links: { view: View; label: string }[] = [
    { view: "home", label: "Home" },
    { view: "history", label: "History" },
    { view: "settings", label: "Settings" },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">RenameFlow</h1>
      </div>
      <nav className="sidebar-nav">
        {links.map((link) => (
          <button
            key={link.view}
            className={`sidebar-link ${currentView === link.view ? "active" : ""}`}
            onClick={() => onNavigate(link.view)}
          >
            {link.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
