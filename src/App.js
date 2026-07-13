import { useEffect, useState, useCallback } from "react";
import {
  getLocalTasks,
  addTaskLocally,
  updateTaskLocally,
  deleteTaskLocally,
  setTaskSyncedLocally,
  markTaskSynced,
  removeLocalTask,
} from "./db";
import { syncPendingTasks } from "./sync";
import { createTodo, updateTodo, deleteTodo } from "./api";

// These three are the ONLY place outside sync.js that call the API
// directly, and only for the "instant online" fast path below. The
// rule that matters is: a task must only ever be POSTed/PUT/DELETEd
// once. That's guaranteed here because the moment one of these calls
// succeeds, the row is immediately flipped to "synced" in IndexedDB —
// so it can never show up in getPendingTasks() and sync.js's queue
// will never touch it again. If we're offline, or this call fails,
// the row is simply left "pending" and sync.js picks it up on the
// next reconnect — never both paths for the same task.
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

  // ===== FULL RECONCILE / OFFLINE-QUEUE FLUSH =====
  // This is now only used for: (1) initial load, so we start from the
  // server's true state, and (2) the moment we come back online, to
  // flush whatever piled up in IndexedDB while offline. Individual
  // add/edit/toggle/delete actions no longer call this while online —
  // they push themselves directly and instantly (see saveTask /
  // toggleComplete / deleteTask below) instead of waiting on a full
  // queue-processing pass every single click.
  const runSync = useCallback(async () => {
    if (!navigator.onLine) {
      setSyncStatus("pending");
      return;
    }

    setSyncStatus("syncing");
    try {
      // syncPendingTasks now queues internally instead of dropping a call
      // that arrives while one is already in flight — so every call here
      // is guaranteed to reflect the latest local edits, not a stale
      // snapshot from before your last save.
      const result = await syncPendingTasks(userEmail);

      if (result && result.success && result.tasks) {
        setTasks(result.tasks);
        setSyncStatus("synced");
      } else {
        const fallbackLocal = await getLocalTasks(userEmail);
        setTasks(fallbackLocal.filter((t) => t.syncStatus !== "pending-delete"));
        setSyncStatus("pending");
      }
    } catch (err) {
      console.error("Sync runtime execution failure:", err);
      setSyncStatus("pending");
    }
  }, [userEmail]);

  // ===== INITIAL LOAD =====
  const initialLoad = useCallback(async () => {
    setLoading(true);

    // 1. Instant paint from local cache
    const localTasks = await getLocalTasks(userEmail);
    setTasks(localTasks.filter((t) => t.syncStatus !== "pending-delete"));
    setLoading(false);

    // 2. Reconcile with server (this is the ONLY network call on load)
    await runSync();
  }, [userEmail, runSync]);

  useEffect(() => {
    if (token && userEmail) initialLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, userEmail]);

  // ===== NETWORK STATUS =====
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      runSync();
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
  }, [runSync]);

  // ===== DARK MODE =====
  useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  // ===== NOTIFICATIONS =====
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    if (Notification.permission !== "granted") return;

    const interval = setInterval(() => {
      const now = new Date();
      const currentDate = now.toISOString().slice(0, 10);
      const systemHours = now.getHours();
      const systemMinutes = now.getMinutes();

      tasks.forEach((task) => {
        if (task.isCompleted || !task.time || !task.date || task.date !== currentDate)
          return;

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
          new Notification("⏰ Task Reminder!", {
            body: `${task.title} — ${task.priority?.toUpperCase() || ""} priority`,
            icon: "/favicon.ico",
            tag: `task-${task.id}-${taskHours}:${taskMinutes}`,
            requireInteraction: true,
          });
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

  const openAddModal = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };
  const openEditModal = (task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };
  const handleCloseModal = () => setIsModalOpen(false);

  // ===== TASK OPERATIONS =====
  // All three of these follow the same pattern:
  // 1. Write to IndexedDB with a "pending-*" status (via db.js)
  // 2. Optimistically update React state so the UI feels instant
  // 3. Call runSync() to let sync.js push it to the server exactly once
  // They never call the API (createTodo/updateTodo/deleteTodo) themselves.

  const saveTask = async (data) => {
    setIsModalOpen(false);

    if (editingTask) {
      // Re-resolve to the CURRENT copy by clientId (see comment above on
      // why editingTask's captured id can go stale).
      const current =
        tasks.find(
          (t) => t.clientId && editingTask.clientId && t.clientId === editingTask.clientId
        ) ||
        tasks.find((t) => t.id === editingTask.id) ||
        editingTask;

      const updated = { ...current, ...data, userEmail };

      // 1. Instant optimistic UI + local cache write — happens the same
      //    way whether we're online or offline.
      setTasks((prev) => prev.map((t) => (t.id === current.id ? updated : t)));
      const localResult = await updateTaskLocally(updated);
      if (!localResult) {
        await runSync();
        return;
      }

      // 2. Online: push just this one change immediately. No loop over
      //    other pending tasks, no full re-fetch — just this row.
      if (navigator.onLine) {
        try {
          const res = await updateTodo(localResult);
          if (res.ok) {
            const cleaned = await setTaskSyncedLocally(localResult);
            setTasks((prev) => prev.map((t) => (t.id === cleaned.id ? cleaned : t)));
            return;
          }
        } catch (err) {
          console.error("Instant update failed, will retry on next sync:", err);
        }
      }
      // Offline, or the instant attempt failed: it stays "pending-update"
      // in IndexedDB (already set by updateTaskLocally) and will be
      // flushed automatically next time we're online.
    } else {
      const tempId = `local-${Date.now()}`;
      const clientId =
        (crypto.randomUUID && crypto.randomUUID()) ||
        `c-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const newTask = {
        id: tempId,
        clientId,
        isCompleted: false,
        userEmail,
        syncStatus: "pending-add",
        ...data,
      };

      setTasks((prev) => [...prev, newTask]);
      await addTaskLocally(newTask, userEmail);

      if (navigator.onLine) {
        try {
          const { id, syncStatus, ...payload } = newTask;
          const res = await createTodo({ ...payload, userEmail });
          if (res.ok) {
            const saved = await res.json();
            // Atomically swaps local-xxxx -> the real server id and
            // carries clientId over.
            await markTaskSynced(tempId, saved.id);
            setTasks((prev) =>
              prev.map((t) =>
                t.id === tempId ? { ...saved, clientId, syncStatus: "synced" } : t
              )
            );
            return;
          }
        } catch (err) {
          console.error("Instant create failed, will retry on next sync:", err);
        }
      }
      // Offline, or failed: stays "pending-add", flushed on reconnect.
    }
  };

  const toggleComplete = async (task) => {
    const current =
      tasks.find((t) => t.clientId && task.clientId && t.clientId === task.clientId) ||
      tasks.find((t) => t.id === task.id) ||
      task;
    const updated = { ...current, isCompleted: !current.isCompleted, userEmail };

    setTasks((prev) => prev.map((t) => (t.id === current.id ? updated : t)));
    const localResult = await updateTaskLocally(updated);
    if (!localResult) {
      await runSync();
      return;
    }

    if (navigator.onLine) {
      try {
        const res = await updateTodo(localResult);
        if (res.ok) {
          const cleaned = await setTaskSyncedLocally(localResult);
          setTasks((prev) => prev.map((t) => (t.id === cleaned.id ? cleaned : t)));
          return;
        }
      } catch (err) {
        console.error("Instant toggle failed, will retry on next sync:", err);
      }
    }
    // Offline, or failed: stays "pending-update", flushed on reconnect.
  };

  const deleteTask = async (id) => {
    const isLocalOnly = String(id).startsWith("local-") || String(id).startsWith("temp-");

    setTasks((prev) => prev.filter((t) => t.id !== id));
    await deleteTaskLocally(id);
    // If it was local-only (never synced), deleteTaskLocally already
    // fully removed it — nothing left to push anywhere.
    if (isLocalOnly) return;

    if (navigator.onLine) {
      try {
        const res = await deleteTodo(id);
        if (res.ok) {
          await removeLocalTask(id);
          return;
        }
      } catch (err) {
        console.error("Instant delete failed, will retry on next sync:", err);
      }
    }
    // Offline, or failed: stays "pending-delete" (already hidden from the
    // UI by the filteredTasks filter below) and gets flushed on reconnect.
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

  if (!token) return <Login onLoginSuccess={handleLoginSuccess} />;

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