import {
  getPendingTasks,
  markTaskSynced,
  removeLocalTask,
  saveTasksLocally,
  getLocalNote, 
  saveNoteLocally
} from "./db";
import { createTodo, updateTodo, deleteTodo, fetchTodos, saveNotesToBackend, fetchNotes } from "./api";

// sync pending local changes to backend
export const syncPendingTasks = async (userEmail) => {
  const pending = await getPendingTasks();

  if (pending.length === 0) return { synced: 0 };

  let syncedCount = 0;

  for (const task of pending) {
    try {
      if (task.syncStatus === "pending-add") {
        // send to backend
        const res = await createTodo({
          title: task.title,
          description: task.description,
          date: task.date,
          time: task.time,
          priority: task.priority,
          isCompleted: task.isCompleted,
        });
        const saved = await res.json();
        // replace local id with server id
        await markTaskSynced(task.id, saved.id);
        syncedCount++;

      } else if (task.syncStatus === "pending-update") {
        await updateTodo({
          id: task.id,
          title: task.title,
          description: task.description,
          date: task.date,
          time: task.time,
          priority: task.priority,
          isCompleted: task.isCompleted,
          userEmail: task.userEmail,
        });
        await markTaskSynced(task.id, task.id);
        syncedCount++;

      } else if (task.syncStatus === "pending-delete") {
        await deleteTodo(task.id);
        await removeLocalTask(task.id);
        syncedCount++;
      }
    } catch (err) {
      console.log("sync failed for task:", task.id, err);
      // keep as pending → retry next time
    }
  }

  // after sync → pull latest from server
  try {
    const res = await fetchTodos();
    const serverTasks = await res.json();
    await saveTasksLocally(serverTasks, userEmail);
    return { synced: syncedCount, tasks: serverTasks };
  } catch (err) {
    return { synced: syncedCount };
  }
};

// pull latest tasks from server
export const pullTasksFromServer = async (userEmail) => {
  const res = await fetchTodos();
  const tasks = await res.json();
  await saveTasksLocally(tasks, userEmail);
  return tasks;
};

export const syncPendingNotes = async (userEmail) => {
  try {
    const localNote = await getLocalNote(userEmail);
    if (localNote && localNote.syncStatus === "pending-update") {
      const payload = {
        notes: localNote.notes,
        userEmail: userEmail
      };
      await saveNotesToBackend(payload);
      
      // Mark as clean down in the local cache
      localNote.syncStatus = "synced";
      await saveNoteLocally(userEmail, localNote.notes);
    }
  } catch (err) {
    console.error("Background notes sync process execution halted", err);
  }
};
