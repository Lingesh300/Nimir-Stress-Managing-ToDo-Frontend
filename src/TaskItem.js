export default function TaskItem({ task, onToggle, onDelete, onEdit, today }) {
  const isOverdue = !task.isCompleted && task.date && task.date < today;

  const priorityColors = {
    high: "#ef4444",
    medium: "#f59e0b",
    low: "#22c55e",
  };

  return (
    <li
      className={`task-item ${task.isCompleted ? "done" : ""} ${isOverdue ? "overdue" : ""}`}
      onClick={() => onEdit(task)}
    >
      <input
        type="checkbox"
        checked={task.isCompleted}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          e.stopPropagation();
          onToggle(task);
        }}
      />

      <div className="task-body">
        <div className="task-title">{task.title}</div>
        {task.description && (
          <div className="task-desc">{task.description}</div>
        )}
        <div className="task-meta">
          {task.date && <span>📅 {task.date}</span>}
          {task.time && <span>⏰ {task.time}</span>}
          {isOverdue && <span className="overdue-tag">Overdue</span>}
        </div>
      </div>

      <div className="task-right">
        <span
          className="priority-dot"
          style={{ background: priorityColors[task.priority] || "#94a3b8" }}
          title={task.priority}
        />
        <button
          className="delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
        >
          ✕
        </button>
      </div>
    </li>
  );
}