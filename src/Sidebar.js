import { useEffect, useState } from "react";
import { generateTelegramCode, getTelegramStatus } from "./api";

export default function Sidebar({ view, setView, onAdd, onLogout, tasks, today, darkMode, setDarkMode }) {
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [telegramCode, setTelegramCode] = useState("");
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    getTelegramStatus()
      .then((res) => res.json())
      .then((data) => setTelegramConnected(data.connected))
      .catch(() => {});
  }, []);

  const handleGenerateCode = async () => {
    try {
      const res = await generateTelegramCode();
      const data = await res.json();
      setTelegramCode(data.code);
      setShowSetup(true);
    } catch (err) {
      alert("Failed to generate code");
    }
  };

  const counts = {
    Today: tasks.filter((t) => !t.isCompleted && (!t.date || t.date <= today)).length,
    Upcoming: tasks.filter((t) => !t.isCompleted && t.date > today).length,
    Completed: tasks.filter((t) => t.isCompleted).length,
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-logo">✊</div>
        <h2>Nimir</h2>
      </div>

      <button className="add-btn" onClick={onAdd}>
        + New Task
      </button>

      <ul className="nav">
        {["Today", "Upcoming", "Completed"].map((v) => (
          <li
            key={v}
            className={view === v ? "active" : ""}
            onClick={() => setView(v)}
          >
            <span className="nav-label">
              {v === "Today" && "📅"}
              {v === "Upcoming" && "🔜"}
              {v === "Completed" && "✅"}
              {" "}{v}
            </span>
            {counts[v] > 0 && <span className="badge">{counts[v]}</span>}
          </li>
        ))}
      </ul>

      {/* ✅ TELEGRAM SECTION */}
      <div className="telegram-section">
        {telegramConnected ? (
          <div className="telegram-connected">
            📱 Telegram Connected ✅
          </div>
        ) : !showSetup ? (
          <button className="telegram-btn" onClick={handleGenerateCode}>
            📱 Connect Telegram
          </button>
        ) : (
          <div className="telegram-setup">
            <small>Follow these steps:</small>
            <div className="setup-steps">
              <p>1. Open Telegram</p>
              <p>2. Search <b>@nimirToDo_bot</b></p>
              <p>3. Send this code:</p>
            </div>
            <div className="code-box">
              <span>{telegramCode}</span>
              <button
                className="copy-btn"
                onClick={() => {
                  navigator.clipboard.writeText(telegramCode);
                  alert("Code copied! 📋");
                }}
              >
                📋
              </button>
            </div>
            <small className="waiting">
              ⏳ Waiting for connection...
            </small>
            <button
              className="check-btn"
              onClick={() => {
                getTelegramStatus()
                  .then((res) => res.json())
                  .then((data) => {
                    if (data.connected) {
                      setTelegramConnected(true);
                      setShowSetup(false);
                    } else {
                      alert("Not connected yet — send the code to @nimirToDo_bot first!");
                    }
                  });
              }}
            >
              ✅ I sent the code!
            </button>
          </div>
        )}
      </div>

      <div className="sidebar-bottom">
        <button className="dark-toggle" onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
        </button>
        <button className="logout-btn" onClick={onLogout}>
          🚪 Logout
        </button>
      </div>
    </aside>
  );
}