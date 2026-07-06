import { useEffect, useState } from "react";
import { generateTelegramCode, getTelegramStatus } from "./api";
import NimirLogo from "./Nimir_Logo.png";
import Notes from "./Notes";

export default function Sidebar({ view, setView, onAdd, onLogout, tasks, today, darkMode, setDarkMode, userEmail }) {
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [telegramCode, setTelegramCode] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    getTelegramStatus()
      .then((res) => res.json())
      .then((data) => setTelegramConnected(data.connected))
      .catch(() => {});
  }, []);

useEffect(() => {
  document.body.style.overflow = mobileOpen ? "hidden" : "";

  return () => {
    document.body.style.overflow = "";
  };
}, [mobileOpen]);

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

  const sidebarContent = (
  <aside className="sidebar">

    <div className="sidebar-top">
      <img 
        src={NimirLogo} 
        alt="Nimir" 
        className="sidebar-logo-img"
      />
      <h2>Nimir</h2>

      <button
        className="close-sidebar-btn"
        onClick={() => setMobileOpen(false)}
      >
        ✕
      </button>
    </div>

    <button
      className="add-btn"
      onClick={() => {
        onAdd();
        setMobileOpen(false);
      }}
    >
      + New Task
    </button>

      <ul className="nav">
        {["Today", "Upcoming", "Completed"].map((v) => (
          <li
            key={v}
            className={view === v ? "active" : ""}
            onClick={() => { setView(v); setMobileOpen(false); }}
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
      <button className="notes-btn" onClick={() => setShowNotes(true)}>
        📝 My Notes
      </button>
      {showNotes && <Notes onClose={() => setShowNotes(false)} userEmail={userEmail} />}

      <div className="telegram-section">
        {telegramConnected ? (
          <div className="telegram-connected">📱 Telegram Connected ✅</div>
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
              <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(telegramCode); alert("Code copied! 📋"); }}>📋</button>
            </div>
            <small className="waiting">⏳ Waiting for connection...</small>
            <button className="check-btn" onClick={() => {
              getTelegramStatus()
                .then((res) => res.json())
                .then((data) => {
                  if (data.connected) { setTelegramConnected(true); setShowSetup(false); }
                  else alert("Not connected yet — send the code to @nimirToDo_bot first!");
                });
            }}>✅ I sent the code!</button>
          </div>
        )}
      </div>

              {userEmail && (
          <div className="logged-in-user">
            <span className="user-avatar">
              {userEmail.charAt(0).toUpperCase()}
            </span>
            <span className="user-email-text">
              {userEmail.length > 20 
                ? userEmail.substring(0, 20) + "..." 
                : userEmail}
            </span>
          </div>
        )}
  
      <div className="sidebar-bottom">
        <button className="dark-toggle" onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
        </button>
        <button className="logout-btn" onClick={onLogout}>🚪 Logout</button>
      </div>
    </aside>
  );

  return (
  <>
    
    <button
      className="hamburger-btn"
      onClick={() => setMobileOpen(true)}
    >
      ☰
    </button>

    
    {mobileOpen && (
      <div
        className="sidebar-overlay"
        onClick={() => setMobileOpen(false)}
      />
    )}

    
    <div className={`sidebar-wrapper ${mobileOpen ? "open" : ""}`}>
      {sidebarContent}
    </div>
  </>
  
);
}