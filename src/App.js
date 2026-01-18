import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import TaskList from "./TaskList";
import FloatingAddButton from "./FloatingAddButton";
import AddTaskModel from "./AddTaskModel";
import "./index.css";

export default function App() {
  const today = new Date().toISOString().slice(0, 10);

  const [view, setView] = useState("Today");
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem("tasks");
    return saved ? JSON.parse(saved) : [];
  });

  const [dark, setDark] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  
  useEffect(() => {
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);


  useEffect(() => {
    localStorage.setItem("tasks", JSON.stringify(tasks));
  }, [tasks]);


  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const checkTasks = () => {
      const now = new Date();

      setTasks((prev) =>
        prev.map((task) => {
          if (
            !task.completed &&
            !task.notified &&
            task.dueAt &&
            new Date(task.dueAt) <= now
          ) {
            if (Notification.permission === "granted") {
              new Notification("⏰ Task Reminder", {
                body: task.title,
              });
            }
            return { ...task, notified: true };
          }
          return task;
        })
      );
    };

    checkTasks(); 
    const interval = setInterval(checkTasks, 30000);

    return () => clearInterval(interval);
  }, []);


  const openAddModal = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const saveTask = (data) => {
    const dueAt = new Date(`${data.date}T${data.time}`);

    if (editingTask) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === editingTask.id ? { ...t, ...data, dueAt } : t
        )
      );
    } else {
      setTasks((prev) => [
        ...prev,
        {
          id: Date.now(),
          completed: false,
          notified: false,
          dueAt,
          ...data,
        },
      ]);
    }
    setIsModalOpen(false);
  };

  const toggleComplete = (id) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, completed: !t.completed } : t
      )
    );
  };

  const deleteTask = (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const filteredTasks = tasks.filter((t) => {
    if (view === "Completed") return t.completed;
    if (view === "Upcoming") return !t.completed && t.date > today;
    return !t.completed && t.date <= today;
  });

  return (
    <div className={`app ${dark ? "dark" : ""}`}>
      <Sidebar
        view={view}
        setView={setView}
        dark={dark}
        setDark={setDark}
      />

      <main className="main">
        <h1>{view}</h1>

        <TaskList
          tasks={filteredTasks}
          onToggle={toggleComplete}
          onDelete={deleteTask}
          onEdit={openEditModal}
        />
      </main>

      <FloatingAddButton onClick={openAddModal} />

      <AddTaskModel
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={saveTask}
        existingTask={editingTask}
      />
    </div>
  );
}
