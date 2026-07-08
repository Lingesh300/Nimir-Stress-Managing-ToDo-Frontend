import { useState, useEffect } from "react";

export default function Notes({ onClose, userEmail }) {
  const notesKey = `nimir-notes-${userEmail}`;  // ✅ unique per user!
  
  const [note, setNote] = useState(
    localStorage.getItem(notesKey) || ""
  );
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem(notesKey, note);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    if (window.confirm("Clear all notes?")) {
      setNote("");
      localStorage.removeItem(notesKey);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(notesKey, note);
    }, 3000);
    return () => clearTimeout(timer);
  }, [note, notesKey]);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="notes-modal" onClick={(e) => e.stopPropagation()}>
        <div className="notes-header">
          <h3>📝 My Notes</h3>
          <div className="notes-actions">
            <small>{note.length} characters</small>
            {saved && <span className="saved-tag">✅ Saved!</span>}
            <button className="notes-clear-btn" onClick={handleClear}>
              🗑️ Clear
            </button>
            <button className="notes-close-btn" onClick={onClose}>✕</button>
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
          <button className="save-btn" onClick={handleSave}>💾 Save</button>
        </div>
      </div>
    </div>
  );
}