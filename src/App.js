import { useEffect, useState, useCallback, useRef } from "react";
import { fetchTodos, createTodo, updateTodo, deleteTodo } from "./api";
import {
  getLocalTasks,
  saveTasksLocally,
  addTaskLocally,
  updateTaskLocally,
  deleteTaskLocally,
} from "./db";
import { syncPendingTasks } from "./sync";
import Sidebar from "./Sidebar";
import TaskList from "./TaskList";
import FloatingAddButton from "./FloatingAddButton";
import AddTaskModal from "./AddTaskModel";
import Login from "./Login";
import "./index.css";

export default function App() {
  const today = new Date().toISOString().slice(0, 10);

  const [token, setToken] = useState(localStorage.getItem("token"));
  const [userEmail, setUserEmail] = useState(
    localStorage.getItem("userEmail") || ""
  );
  const [view, setView] = useState("Today");
  const [tasks, setTasks] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("darkMode") === "true"
  );
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState("synced");

  // ===== ONLINE/OFFLINE DETECTION & AUTOMATIC UI STATE SYNC =====
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setSyncStatus("syncing");
      try {
        const result = await syncPendingTasks(userEmail);
        if (result && result.tasks) {
          setTasks(result.tasks);
        } else {
          const currentLocal = await getLocalTasks(userEmail);
          setTasks(currentLocal.filter(t => t.syncStatus !== "pending-delete"));
        }
        setSyncStatus("synced");
      } catch (err) {
        console.error("Online synchronization processing failed", err);
        setSyncStatus("pending");
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus("pending");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [userEmail]);

  // ===== DARK MODE =====
  useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  // ===== LOAD TASKS =====
  const loadTasks = useCallback(async () => {
    setLoading(true);
    const localTasks = await getLocalTasks(userEmail);
    if (localTasks.length > 0) {
      setTasks(localTasks.filter(t => t.syncStatus !== "pending-delete"));
      setLoading(false);
    }

    if (navigator.onLine) {
      try {
        const res = await fetchTodos();
        if (res.status === 403 || res.status === 401) {
          handleLogout();
          return;
        }
        const serverTasks = await res.json();
        await saveTasksLocally(serverTasks, userEmail);
        setTasks(serverTasks);
        setSyncStatus("synced");
      } catch (err) {
        console.error("Failed to fetch from server", err);
        setSyncStatus("pending");
      }
    } else {
      setSyncStatus("pending");
    }
    setLoading(false);
  }, [userEmail]);

  useEffect(() => {
    if (token && userEmail) loadTasks();
  }, [token, userEmail, loadTasks]);

  // ==========================================
  // ⏰ STABLE 30-SECOND POLLING NOTIFICATION ENGINE
  // ==========================================
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const notifiedRef = useRef(new Set());

  useEffect(() => {
    if (!token) return;
    if (Notification.permission !== "granted") return;

    const interval = setInterval(() => {
      const now = new Date();
      const currentDate = now.toISOString().slice(0, 10);

      const systemHours = now.getHours();
      const systemMinutes = now.getMinutes();

      tasks.forEach((task) => {
        if (task.isCompleted || !task.time || !task.date || task.date !== currentDate) return;

        let taskHours = 0;
        let taskMinutes = 0;

        if (task.time.toUpperCase().includes("AM") || task.time.toUpperCase().includes("PM")) {
          const cleanTimeStr = task.time.replace(/[^0-9:]/g, "");
          const isPM = task.time.toUpperCase().includes("PM");

          const [h, m] = cleanTimeStr.split(":");
          taskHours = parseInt(h, 10);
          taskMinutes = parseInt(m, 10);

          if (taskHours === 12) {
            taskHours = isPM ? 12 : 0;
          } else if (isPM) {
            taskHours += 12;
          }
        } else {
          const [h, m] = task.time.split(":");
          taskHours = parseInt(h, 10);
          taskMinutes = parseInt(m, 10);
        }

        if (taskHours === systemHours && taskMinutes === systemMinutes) {
          const notifyKey = `${task.id}-${currentDate}-${taskHours}:${taskMinutes}`;

          if (notifiedRef.current.has(notifyKey)) return;

          new Notification("⏰ Task Reminder!", {
            body: `${task.title} — ${task.priority?.toUpperCase() || ""} priority`,
            icon: "/favicon.ico",
            tag: `task-${task.id}-${taskHours}:${taskMinutes}`,
            requireInteraction: true
          });

          notifiedRef.current.add(notifyKey);
        }
      });

      // Clean old tracking keys
      notifiedRef.current.forEach((key) => {
        if (!key.includes(`-${currentDate}-`)) {
          notifiedRef.current.delete(key);
        }
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [tasks, token]);

  // ===== AUTH =====
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    setToken(null);
    setUserEmail("");
    setTasks([]);
  };

  const handleLoginSuccess = (newToken, email) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("userEmail", email);
    setToken(newToken);
    setUserEmail(email);
  };

  // ===== MODAL =====
  const openAddModal = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // ===== TASK OPERATIONS =====
  const saveTask = async (data) => {
    setIsModalOpen(false);

    if (editingTask) {
      const originalId = editingTask.id;
      const updated = { ...editingTask, ...data, userEmail };
      
      // Optimistic state update
      setTasks((prev) =>
        prev.map((t) => (t.id === originalId ? updated : t))
      );
      await updateTaskLocally(updated);

      if (isOnline) {
        try {
          const res = await updateTodo(updated);
          const savedFromServer = await res.json();
          
          // ✅ FIX: Overwrite state and IndexedDB with the unified server ID response
          setTasks((prev) => {
            const updatedState = prev.map((t) => (t.id === originalId ? { ...savedFromServer, syncStatus: "synced" } : t));
            saveTasksLocally(updatedState, userEmail);
            return updatedState;
          });
        } catch (err) {
          console.error("Online task update push failed", err);
        }
      } else {
        setSyncStatus("pending");
      }
    } else {
      const tempId = `local-${Date.now()}`;
      const newTask = {
        id: tempId,
        isCompleted: false,
        userEmail,
        syncStatus: "pending-add",
        ...data,
      };

      setTasks((prev) => [...prev, newTask]);
      await addTaskLocally(newTask, userEmail);

      if (isOnline) {
        try {
          const res = await createTodo({ ...data, isCompleted: false, userEmail });
          const saved = await res.json();
          
          setTasks((prev) => {
            const updatedState = prev.map((t) => (t.id === tempId ? { ...saved, syncStatus: "synced" } : t));
            saveTasksLocally(updatedState, userEmail);
            return updatedState;
          });
        } catch (err) {
          setSyncStatus("pending");
        }
      } else {
        setSyncStatus("pending");
      }
    }
  };

  const toggleComplete = async (task) => {
    const updated = { ...task, isCompleted: !task.isCompleted, userEmail };
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? updated : t))
    );
    await updateTaskLocally(updated);
    if (isOnline) {
      const res = await updateTodo(updated);
      const saved = await res.json();
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...saved, syncStatus: "synced" } : t))
      );
    } else {
      setSyncStatus("pending");
    }
  };

  const deleteTask = async (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await deleteTaskLocally(id);
    if (isOnline) {
      await deleteTodo(id);
    } else {
      setSyncStatus("pending");
    }
  };

  // ===== SORTING =====
  const priorityOrder = { high: 1, medium: 2, low: 3 };
  const isOverdue = (task) => !task.isCompleted && task.date && task.date < today;

  const filteredTasks = tasks
    .filter((t) => {
      if (t.syncStatus === "pending-delete") return false;
      if (view === "Completed") return t.isCompleted;
      if (view === "Upcoming") return !t.isCompleted && t.date > today;
      return !t.isCompleted && (!t.date || t.date <= today);
    })
    .sort((a, b) => {
      const aPriority = priorityOrder[a.priority] || 2;
      const bPriority = priorityOrder[b.priority] || 2;
      const aOverdue = isOverdue(a);
      const bOverdue = isOverdue(b);
      const aScore = aOverdue ? aPriority * 10 : aPriority * 10 + 5;
      const bScore = bOverdue ? bPriority * 10 : bPriority * 10 + 5;
      if (aScore !== bScore) return aScore - bScore;
      if (a.date !== b.date) return new Date(a.date) - new Date(b.date);
      return (a.id || 0) - (b.id || 0);
    });

  if (!token) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className={`app ${darkMode ? "dark" : ""}`}>
      <Sidebar
        view={view}
        setView={setView}
        onAdd={openAddModal}
        onLogout={handleLogout}
        tasks={tasks}
        today={today}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        userEmail={userEmail}
      />

      <main className="main">
        <div className="main-header">
          <h1>
            {view === "Today" && "Today's Tasks"}
            {view === "Upcoming" && "Upcoming Tasks"}
            {view === "Completed" && "Completed Tasks"}
          </h1>

          <div className={`sync-badge ${syncStatus}`}>
            {syncStatus === "synced" && "✅ Synced"}
            {syncStatus === "syncing" && "🔄 Syncing..."}
            {syncStatus === "pending" && "📡 Offline"}
          </div>
        </div>

        {view === "Today" && filteredTasks.some(isOverdue) && (
          <div className="overdue-warning">
            ⚠️ You have overdue tasks — finish them first!
          </div>
        )}

        {!isOnline && (
          <div className="offline-banner">
            📡 You're offline — changes will sync when back online
          </div>
        )}

        {loading && tasks.length === 0 ? (
          <p className="loading">Loading...</p>
        ) : (
          <TaskList
            tasks={filteredTasks}
            onToggle={toggleComplete}
            onDelete={deleteTask}
            onEdit={openEditModal}
            today={today}
          />
        )}
      </main>

      <FloatingAddButton onClick={openAddModal} />

      <AddTaskModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={saveTask}
        existingTask={editingTask}
        tasks={tasks}
        today={today}
      />
    </div>
  );
}