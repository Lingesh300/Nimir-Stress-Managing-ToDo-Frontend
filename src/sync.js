import {
  getPendingTasks,
  markTaskSynced,
  removeLocalTask,
  saveTasksLocally,
  getLocalNote,
  saveNoteLocally,
} from "./db";
import {
  createTodo,
  updateTodo,
  deleteTodo,
  fetchTodos,
  saveNotesToBackend,
} from "./api";

// ⚠️ IMPORTANT: this file is the ONLY place that should call
// createTodo / updateTodo / deleteTodo / fetchTodos.
// App.js should never call the api.js functions directly —
// it should only write to IndexedDB (via db.js) and then call
// syncPendingTasks(). This is what was causing duplicates: two
// different places were POSTing the same task to the server.

// Module-level lock so two triggers (e.g. mount load + "online"
// event + a manual save happening at the same time) can never
// run this function concurrently and double-POST the same task.
let isSyncing = false;

export const syncPendingTasks = async (userEmail) => {
  if (isSyncing) {
    // A sync is already running — don't start a second one.
    // The caller can just wait for the in-flight one to finish
    // (or you can await a shared promise if you want to be fancier).
    return { success: false, tasks: null, busy: true };
  }

  isSyncing = true;

  try {
    // --- PART A: SYNC NOTES ---
    try {
      const localNote = await getLocalNote(userEmail);
      if (localNote && localNote.syncStatus === "pending-update") {
        const payload = { notes: localNote.notes, userEmail };
        await saveNotesToBackend(payload);
        await saveNoteLocally(userEmail, localNote.notes); // marks synced
      }
    } catch (noteErr) {
      console.error("Notes sync halted:", noteErr);
    }

    // --- PART B: PUSH EVERY PENDING TASK EXACTLY ONCE ---
    const pending = await getPendingTasks();

    for (const task of pending) {
      try {
        if (task.syncStatus === "pending-add") {
          const { id, syncStatus, ...taskPayload } = task;
          const res = await createTodo({ ...taskPayload, userEmail });
          if (res.ok) {
            const savedFromServer = await res.json();
            // This deletes the old local-xxxx row AND inserts the
            // server-id row in one atomic step — no leftover duplicate.
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
        console.error("Failed to sync task:", task.id, err);
        // leave it as pending — it'll retry next sync
      }
    }

    // --- PART C: PULL THE SERVER'S VERSION OF TRUTH ---
    // By the time we get here every pending-add/update/delete has
    // already been resolved above, so this pull can safely replace
    // all "synced" rows without racing anything.
    try {
      const res = await fetchTodos();
      if (res.ok) {
        const serverTasks = await res.json();
        await saveTasksLocally(serverTasks, userEmail);
        return { success: true, tasks: serverTasks };
      }
    } catch (err) {
      console.error("Post-sync pull failed:", err);
    }

    return { success: false, tasks: null };
  } finally {
    isSyncing = false;
  }
};