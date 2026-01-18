import React, { useState, useEffect } from "react";

const AddTaskModel = ({ isOpen, onClose, onSave, existingTask }) => {

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [priority, setPriority] = useState("Medium");

  useEffect(() => {
    if (!isOpen) return;

    if (existingTask) {
      setTitle(existingTask.title || "");
      setDescription(existingTask.description || "");
      setDate(existingTask.date || "");
      setTime(existingTask.time || "");
      setPriority(existingTask.priority || "Medium");
    } else {
      setTitle("");
      setDescription("");
      setDate("");
      setTime("");
      setPriority("Medium");
    }
  }, [existingTask, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!title || !date || !time) {
      alert("Please fill all required fields");
      return;
    }

    onSave({
      title,
      description,
      date,
      time,
      priority,
    });
  };

return (
  isOpen && (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <h2>Add New Task</h2>
            <p>Create a new task with notifications.</p>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <label>
            Task Title *
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>

          <label>
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div className="row">
            <label>
              Due Date *
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>

            <label>
              Due Time *
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </label>
          </div>

          <label>
            Priority
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </label>

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="add-btn">
              Add Task
            </button>
          </div>
        </form>
      </div>
    </div>
  )
);
}
export default AddTaskModel;
