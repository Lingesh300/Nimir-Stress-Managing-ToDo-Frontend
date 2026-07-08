import { getPendingTasks, markTaskSynced, removeLocalTask, saveTasksLocally, getLocalNote, saveNoteLocally } from "./db";
import { createTodo, updateTodo, deleteTodo, fetchTodos, saveNotesToBackend } from "./api";

// 1. Core Synchronization Process (Handles BOTH Tasks and Notes)
export const syncPendingTasks = async (userEmail) => {
  // --- PART A: SYNC NOTES FIRST ---
  try {
    const localNote = await getLocalNote(userEmail);
    if (localNote && localNote.syncStatus === "pending-update") {
      const payload = {
        notes: localNote.notes,
        userEmail: userEmail
      };
      await saveNotesToBackend(payload);
      
      // Mark notes clean in local IndexedDB
      localNote.syncStatus = "synced";
      await saveNoteLocally(userEmail, localNote.notes);
    }
  } catch (noteErr) {
    console.error("Background notes sync execution halted:", noteErr);
  }

  // --- PART B: SYNC TASKS ---
  const pending = await getPendingTasks();
  
  if (pending.length === 0) {
    // If no offline task changes, just pull down the latest web state
    try {
      const res = await fetchTodos();
      const serverTasks = await res.json();
      await saveTasksLocally(serverTasks, userEmail);
      return { synced: 0, tasks: serverTasks };
    } catch {
      return { synced: 0 };
    }
  }

  let syncedCount = 0;

  for (const task of pending) {
    try {
      if (task.syncStatus === "pending-add") {
        // Strip out local metadata before pushing to Spring Boot
        const { id, syncStatus, ...taskPayload } = task; 
        
        const res = await createTodo(taskPayload);
        if (res.ok) {
          const savedFromServer = await res.json();
          await markTaskSynced(task.id, savedFromServer.id);
          syncedCount++;
        }

      } else if (task.syncStatus === "pending-update") {
        const res = await updateTodo(task);
        if (res.ok) {
          await markTaskSynced(task.id, task.id);
          syncedCount++;
        }

      } else if (task.syncStatus === "pending-delete") {
        const res = await deleteTodo(task.id);
        if (res.ok) {
          await removeLocalTask(task.id);
          syncedCount++;
        }
      }
    } catch (err) {
      console.error("Failed to sync individual offline task:", task.id, err);
    }
  }

  // --- PART C: FINAL PRISTINE CLOUD RECONCILIATION ---
  try {
    const res = await fetchTodos();
    const serverTasks = await res.json();
    await saveTasksLocally(serverTasks, userEmail);
    return { synced: syncedCount, tasks: serverTasks };
  } catch (err) {
    console.error("Post-sync server pull failed:", err);
    return { synced: syncedCount };
  }
};

// 2. Pure Web-to-App Pull Down Fallback
export const pullTasksFromServer = async (userEmail) => {
  const res = await fetchTodos();
  const tasks = await res.json();
  await saveTasksLocally(tasks, userEmail);
  return tasks;
};