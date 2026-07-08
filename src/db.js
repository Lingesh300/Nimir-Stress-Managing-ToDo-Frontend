// IndexedDB wrapper for Nimir offline storage

const DB_NAME = "nimir-db";
const DB_VERSION = 1;
const STORE_NAME = "tasks";

// open database
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("userEmail", "userEmail", { unique: false });
        store.createIndex("syncStatus", "syncStatus", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// save all tasks (replace all)
export const saveTasksLocally = async (tasks, userEmail) => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  // clear existing synced tasks for this user
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
        store.put({ ...task, syncStatus: "synced" });
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
export const updateTaskLocally = async (task) => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  const updated = {
    ...task,
    syncStatus: task.syncStatus === "synced" ? "pending-update" : task.syncStatus,
  };

  return new Promise((resolve, reject) => {
    const request = store.put(updated);
    request.onsuccess = () => resolve(updated);
    request.onerror = () => reject(request.error);
  });
};

// delete task locally
export const deleteTaskLocally = async (id) => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  // mark as pending delete instead of removing
  return new Promise((resolve, reject) => {
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const task = getRequest.result;
      if (task) {
        if (String(task.id).startsWith("local-")) {
          // never synced → just remove
          store.delete(id);
        } else {
          // synced before → mark for deletion
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
        // delete old local entry
        store.delete(localId);
        // save with real server id
        store.put({
          ...task,
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

const NOTES_STORE_NAME = "notes_sync";

// Update openDB inside db.js to register this store if it doesn't exist
// Inside your request.onupgradeneeded:
if (!db.objectStoreNames.contains(NOTES_STORE_NAME)) {
  db.createObjectStore(NOTES_STORE_NAME, { keyPath: "userEmail" });
}

// 1. Write note locally with sync flags
export const saveNoteLocally = async (userEmail, notesText) => {
  const db = await openDB();
  const tx = db.transaction(NOTES_STORE_NAME, "readwrite");
  const store = tx.objectStore(NOTES_STORE_NAME);
  
  const record = {
    userEmail,
    notes: notesText,
    syncStatus: "pending-update",
    updatedAt: Date.now()
  };
  
  await store.put(record);
};

// 2. Read note locally
export const getLocalNote = async (userEmail) => {
  const db = await openDB();
  const tx = db.transaction(NOTES_STORE_NAME, "readonly");
  const store = tx.objectStore(NOTES_STORE_NAME);
  return await store.get(userEmail);
};