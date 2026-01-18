export default function TaskItem({ task, onToggle, onDelete, onEdit }) {
  return (
    <li  className={`task-card ${task.completed ? "completed" : ""}`} onClick={() => onEdit(task)}>
      <div className="task-left">
        <input
          type="checkbox"
          checked={task.completed}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onToggle(task.id)}
        />
      </div>

      <div className="task-content">
        <div className="task-header">
          <h3>{task.title}</h3>
          <span className={`priority ${task.priority.toLowerCase()}`}>
            {task.priority}
          </span>
        </div>

        {task.description && (
          <p className="task-desc">{task.description}</p>
        )}

        <p className="task-meta">
          {new Date(task.date).toDateString()} • {task.time}
        </p>
      </div>

      <button
        className="delete-btn"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(task.id);
        }}
      >
        ✕
      </button>
    </li>
  );
}
