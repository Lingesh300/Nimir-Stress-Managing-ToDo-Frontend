import { useState, useEffect } from "react";

export default function Notes({ onClose }) {
  const [note, setNote] = useState(
    localStorage.getItem("nimir-notes") || ""
  );
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem("nimir-notes", note);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    if (window.confirm("Clear all notes?")) {
      setNote("");
      localStorage.removeItem("nimir-notes");
    }
  };

  // auto save every 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem("nimir-notes", note);
    }, 3000);
    return () => clearTimeout(timer);
  }, [note]);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="notes-modal" onClick={(e) => e.stopPropagation()}>
        
        <div className="notes-header">
          <h3>📝 My Notes</h3>
          <div className="notes-actions">
            {saved && <span className="saved-tag">✅ Saved!</span>}
            <small>{note.length} characters</small>
            <button className="notes-clear-btn" onClick={handleClear}>
              🗑️ Clear
            </button>
            <button className="notes-close-btn" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <textarea
          className="notes-textarea"
          placeholder="Write anything here... ideas, thoughts, reminders 💭"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          autoFocus
        />

        <div className="notes-footer">
          <button className="save-btn" onClick={handleSave}>
            💾 Save
          </button>
        </div>

      </div>
    </div>
  );
}