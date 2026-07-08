import { useEffect, useState } from "react";

export default function AddTaskModal({ isOpen, onClose, onSave, existingTask, tasks, today }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [priority, setPriority] = useState("medium");

  useEffect(() => {
  if (existingTask) {
    setTitle(existingTask.title || "");
    setDescription(existingTask.description || "");
    setDate(existingTask.date || today);
    setTime(existingTask.time || "");
    setPriority(existingTask.priority || "medium");
  } else {
    setTitle("");
    setDescription("");
    setDate(today);
    setTime("");
    setPriority("medium");
  }
}, [existingTask, isOpen, today]);

  if (!isOpen) return null;

  const highCount = tasks.filter(
    (t) =>
      t.date === date &&
      t.priority === "high" &&
      t.id !== existingTask?.id &&
      !t.isCompleted
  ).length;

  const handleSave = () => {
    if (!title.trim()) return;
    if (priority === "high" && highCount >= 3) {
      alert("Max 3 high priority tasks per day bro! 😅");
      return;
    }
    onSave({ title, description, date, time, priority });
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{existingTask ? "✏️ Edit Task" : "➕ New Task"}</h3>

        <label>Title</label>
        <input
          placeholder="What needs to be done?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          autoFocus
        />

        <label>Description (optional)</label>
        <textarea
          placeholder="Any notes?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <label>Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <label>Time (optional)</label>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />

        <label>Priority</label>
        <div className="priority-picker">
          {["low", "medium", "high"].map((p) => (
            <button
              key={p}
              className={`priority-opt ${priority === p ? "selected" : ""} ${p}`}
              onClick={() => setPriority(p)}
            >
              {p === "high" && "🔴"}
              {p === "medium" && "🟡"}
              {p === "low" && "🟢"}
              {" "}{p}
            </button>
          ))}
        </div>

        {priority === "high" && (
          <small className="high-warning">
            {highCount}/3 high priority used today
          </small>
        )}

        <div className="modal-actions">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="save-btn" onClick={handleSave}>
            {existingTask ? "Update" : "Add Task"}
          </button>
        </div>
      </div>
    </div>
  );
}