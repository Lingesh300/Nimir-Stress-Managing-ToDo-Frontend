import { getPendingTasks, markTaskSynced, removeLocalTask, saveTasksLocally, getLocalNote, saveNoteLocally } from "./db";
import { createTodo, updateTodo, deleteTodo, fetchTodos, saveNotesToBackend } from "./api";

// 🚀 UNIFIED SYNC & FETCH DAEMON
public const syncPendingTasks = async (userEmail) => {
  // --- PART A: SYNC NOTES ---
  try {
    const localNote = await getLocalNote(userEmail);
    if (localNote && localNote.syncStatus === "pending-update") {
      const payload = { notes: localNote.notes, userEmail };
      await saveNotesToBackend(payload);
      localNote.syncStatus = "synced";
      await saveNoteLocally(userEmail, localNote.notes);
    }
  } catch (noteErr) {
    console.error("Notes sync execution halted:", noteErr);
  }

  // --- PART B: SYNC PENDING TASK QUEUES ---
  const pending = await getPendingTasks();
  
  for (const task of pending) {
    try {
      if (task.syncStatus === "pending-add") {
        const { id, syncStatus, ...taskPayload } = task; 
        const res = await createTodo({ ...taskPayload, userEmail });
        if (res.ok) {
          const savedFromServer = await res.json();
          await markTaskSynced(task.id, savedFromServer.id);
        }
      } else if (task.syncStatus === "pending-update") {
        const { syncStatus, ...taskPayload } = task;
        const res = await updateTodo({ ...taskPayload, userEmail });
        if (res.ok) {
          await markTaskSynced(task.id, task.id);
        }
      } else if (task.syncStatus === "pending-delete") {
        const res = await deleteTodo(task.id);
        if (res.ok) {
          await removeLocalTask(task.id);
        }
      }
    } catch (err) {
      console.error("Failed to sync individual offline task:", task.id, err);
    }
  }

  // --- PART C: FETCH CLEAN DATA STREAM FROM CLOUD ---
  try {
    const res = await fetchTodos();
    if (res.ok) {
      const serverTasks = await res.json();
      // Overwrite local database cache with absolute truth
      await saveTasksLocally(serverTasks, userEmail);
      return { success: true, tasks: serverTasks };
    }
  } catch (err) {
    console.error("Cloud data pull failed:", err);
  }
  
  return { success: false, tasks: null };
};