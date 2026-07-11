import {
  getPendingTasks,
  markTaskSynced,
  removeLocalTask,
  saveTasksLocally,
  getLocalTasks,
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

// IMPORTANT: this file is the ONLY place that should call
// createTodo / updateTodo / deleteTodo / fetchTodos.
// App.js should only write to IndexedDB (via db.js) and then call
// syncPendingTasks().
//
// Previously this used a boolean lock that returned { busy: true }
// and dropped the request if a sync was already running. That
// silently lost edits: if you saved a change while a sync was
// mid-flight, that change never got pushed until some unrelated
// later sync happened to run. Now we queue instead of drop: every
// call either runs immediately or chains onto the current run and
// then does one more pass, so nothing is ever lost.
let inFlight = null;

export const syncPendingTasks = (userEmail) => {
  const run = (inFlight ? inFlight.then(() => runSyncOnce(userEmail)) : runSyncOnce(userEmail));
  inFlight = run;
  run.finally(() => {
    if (inFlight === run) inFlight = null;
  });
  return run;
};

const runSyncOnce = async (userEmail) => {
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
          // Deletes the old local-xxxx row AND inserts the server-id
          // row atomically — clientId carries over via markTaskSynced.
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
  try {
    const res = await fetchTodos();
    if (res.ok) {
      const serverTasks = await res.json();

      // The backend doesn't know about clientId (it's a purely local
      // identity we use so edits can survive a task's id changing
      // from local-xxxx to a real server id). Re-attach it here from
      // whatever we already have locally, keyed by id, so it never
      // gets lost on a refresh/full sync.
      const priorLocal = await getLocalTasks(userEmail);
      const clientIdByServerId = new Map(
        priorLocal.filter((t) => t.clientId).map((t) => [String(t.id), t.clientId])
      );
      const merged = serverTasks.map((t) => ({
        ...t,
        clientId: clientIdByServerId.get(String(t.id)) || t.clientId || `c-${t.id}`,
      }));

      await saveTasksLocally(merged, userEmail);
      return { success: true, tasks: merged };
    }
  } catch (err) {
    console.error("Post-sync pull failed:", err);
  }

  return { success: false, tasks: null };
};