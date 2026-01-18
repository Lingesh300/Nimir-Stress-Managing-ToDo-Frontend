export default function Sidebar({ view, setView, dark, setDark }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Tasks</span>

        <button
          className="theme-switch"
          onClick={() => setDark(!dark)}
          title="Toggle theme"
        >
          {dark ? "☀️" : "🌙"}
        </button>
      </div>

      <ul>
        <li
          className={view === "Today" ? "active" : ""}
          onClick={() => setView("Today")}
        >
          Today
        </li>
        <li
          className={view === "Upcoming" ? "active" : ""}
          onClick={() => setView("Upcoming")}
        >
          Upcoming
        </li>
        <li
          className={view === "Completed" ? "active" : ""}
          onClick={() => setView("Completed")}
        >
          Completed
        </li>
      </ul>
    </aside>
  );
}
