// IndexedDB wrapper for Nimir offline storage

const DB_NAME = "nimir-db";
const DB_VERSION = 1;
const STORE_NAME = "tasks";
const NOTES_STORE_NAME = "notes_sync";

// open database
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const dbInstance = event.target.result;

      // Handle Tasks Object Store
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        const store = dbInstance.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("userEmail", "userEmail", { unique: false });
        store.createIndex("syncStatus", "syncStatus", { unique: false });
      }

      // Notes store generation
      if (!dbInstance.objectStoreNames.contains(NOTES_STORE_NAME)) {
        dbInstance.createObjectStore(NOTES_STORE_NAME, { keyPath: "userEmail" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// save all tasks (replace all synced tasks safely)
export const saveTasksLocally = async (tasks, userEmail) => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  const index = store.index("userEmail");
  const request = index.getAll(userEmail);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const existing = request.result;
      // delete synced ones (keep pending)
      existing.forEach((task) => {
        if (task.syncStatus === "synced") {
          store.delete(task.id);
        }
      });
      // add fresh from server
      tasks.forEach((task) => {
        store.put({ ...task, syncStatus: "synced", userEmail });
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
};

// get all tasks for user
export const getLocalTasks = async (userEmail) => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const index = store.index("userEmail");

  return new Promise((resolve, reject) => {
    const request = index.getAll(userEmail);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

// add task locally with pending status
export const addTaskLocally = async (task, userEmail) => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  const localTask = {
    ...task,
    id: task.id || `local-${Date.now()}`,
    userEmail,
    syncStatus: "pending-add",
  };

  return new Promise((resolve, reject) => {
    const request = store.put(localTask);
    request.onsuccess = () => resolve(localTask);
    request.onerror = () => reject(request.error);
  });
};

// update task locally
// Returns the updated record on success, or null if the record didn't
// exist (this used to silently `put()` a brand-new row under a stale id
// and resurrect tasks that had already been deleted/migrated during a
// sync — that was the source of the duplicate-on-edit bug).
export const updateTaskLocally = async (task) => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const getRequest = store.get(task.id);
    getRequest.onsuccess = () => {
      const existing = getRequest.result;
      if (!existing) {
        console.warn(
          `updateTaskLocally: no local row for id "${task.id}" — skipping write to avoid recreating a deleted/migrated task.`
        );
        resolve(null);
        return;
      }

      const updated = {
        ...task,
        syncStatus: existing.syncStatus === "synced" ? "pending-update" : existing.syncStatus,
      };

      const putRequest = store.put(updated);
      putRequest.onsuccess = () => resolve(updated);
      putRequest.onerror = () => reject(putRequest.error);
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
};

// delete task locally
export const deleteTaskLocally = async (id) => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const task = getRequest.result;
      if (task) {
        if (String(task.id).startsWith("local-") || String(task.id).startsWith("temp-")) {
          store.delete(id);
        } else {
          store.put({ ...task, syncStatus: "pending-delete" });
        }
      }
      resolve();
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
};

// get pending tasks
export const getPendingTasks = async () => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const index = store.index("syncStatus");

  return new Promise((resolve, reject) => {
    const pending = [];
    const statuses = ["pending-add", "pending-update", "pending-delete"];
    let completed = 0;

    statuses.forEach((status) => {
      const request = index.getAll(status);
      request.onsuccess = () => {
        pending.push(...request.result);
        completed++;
        if (completed === statuses.length) resolve(pending);
      };
      request.onerror = () => reject(request.error);
    });
  });
};

// mark task as synced
export const markTaskSynced = async (localId, serverId) => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const getRequest = store.get(localId);
    getRequest.onsuccess = () => {
      const task = getRequest.result;
      if (task) {
        store.delete(localId);
        store.put({
          ...task, // clientId (if present) carries over automatically
          id: serverId || localId,
          syncStatus: "synced",
        });
      }
      resolve();
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
};

// delete synced task completely
export const removeLocalTask = async (id) => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// 📝 NOTES LAYER
export const saveNoteLocally = async (userEmail, notesText) => {
  const db = await openDB();
  const tx = db.transaction(NOTES_STORE_NAME, "readwrite");
  const store = tx.objectStore(NOTES_STORE_NAME);

  const record = {
    userEmail,
    notes: notesText,
    syncStatus: "pending-update",
    updatedAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    store.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const getLocalNote = async (userEmail) => {
  const db = await openDB();
  const tx = db.transaction(NOTES_STORE_NAME, "readonly");
  const store = tx.objectStore(NOTES_STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.get(userEmail);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};