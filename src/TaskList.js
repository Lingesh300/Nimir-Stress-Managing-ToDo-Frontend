import TaskItem from "./TaskItem";

export default function TaskList({ tasks, onToggle, onDelete, onEdit, today }) {
  if (!tasks.length) {
    return (
      <div className="empty-state">
        <p>🎉 No tasks here!</p>
        <small>Click + to add one</small>
      </div>
    );
  }

  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onToggle={onToggle}
          onDelete={onDelete}
          onEdit={onEdit}
          today={today}
        />
      ))}
    </ul>
  );
}