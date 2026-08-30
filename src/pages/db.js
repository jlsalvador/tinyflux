/* global indexedDB */

// Tinyflux — IndexedDB storage for entries and feed icons.
//
// All reads and writes of entries and icons go through this module so every
// open context (background service worker and one or more popup/sidebar
// instances) shares a single source of truth. Each exported function performs
// its work inside a single atomic IDB transaction, so the browser's own
// per-transaction serialization replaces the hand-rolled promise queue that
// used to guard storage.local writes: two overlapping mutations can no longer
// clobber each other.

const DB_NAME = "tinyflux";
const DB_VERSION = 1;
const STORE_ENTRIES = "entries";
const STORE_ICONS = "icons";

let dbPromise = null;

// Lazily open (and cache) the database, creating the object stores on first
// use.
function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_ENTRIES)) {
          db.createObjectStore(STORE_ENTRIES, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_ICONS)) {
          db.createObjectStore(STORE_ICONS, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

// --- Entries ---------------------------------------------------------------

// All entries currently stored, as a plain array.
export async function getEntries() {
  const db = await openDB();
  const txn = db.transaction(STORE_ENTRIES, "readonly");
  const store = txn.objectStore(STORE_ENTRIES);
  return new Promise((resolve, reject) => {
    txn.onerror = () => reject(txn.error);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
  });
}

// Replace the whole set of entries with the given list. Used by the refresh
// path, which always downloads the complete unread set and overwrites the
// cache so it exactly mirrors the server.
export async function replaceEntries(entries) {
  const db = await openDB();
  const txn = db.transaction(STORE_ENTRIES, "readwrite");
  const store = txn.objectStore(STORE_ENTRIES);
  return new Promise((resolve, reject) => {
    txn.onerror = () => reject(txn.error);
    txn.oncomplete = () => resolve();
    store.clear();
    for (const entry of entries) store.put(entry);
  });
}

// Delete the entries with the given ids (mark-as-read path).
export async function deleteEntries(ids) {
  const db = await openDB();
  const txn = db.transaction(STORE_ENTRIES, "readwrite");
  const store = txn.objectStore(STORE_ENTRIES);
  return new Promise((resolve, reject) => {
    txn.onerror = () => reject(txn.error);
    txn.oncomplete = () => resolve();
    for (const id of ids) store.delete(id);
  });
}

// Insert each entry only if its id is not already present. Used to restore
// entries that were optimistically removed but could not be confirmed with the
// server.
export async function upsertEntries(entries) {
  const db = await openDB();
  const txn = db.transaction(STORE_ENTRIES, "readwrite");
  const store = txn.objectStore(STORE_ENTRIES);
  return new Promise((resolve, reject) => {
    txn.onerror = () => reject(txn.error);
    txn.oncomplete = () => resolve();
    for (const entry of entries) {
      const existing = store.get(entry.id);
      existing.onsuccess = () => {
        if (!existing.result) store.put(entry);
      };
    }
  });
}

// Read-modify-write a single entry atomically. `updater` receives the stored
// record and returns the replacement value, or null to leave the entry
// untouched (e.g. it no longer exists). Runs in one transaction, so the read
// and the write cannot interleave with another context's mutation.
export async function updateEntry(id, updater) {
  const db = await openDB();
  const txn = db.transaction(STORE_ENTRIES, "readwrite");
  const store = txn.objectStore(STORE_ENTRIES);
  return new Promise((resolve, reject) => {
    txn.onerror = () => reject(txn.error);
    txn.oncomplete = () => resolve();
    const req = store.get(id);
    req.onsuccess = () => {
      if (!req.result) return;
      const updated = updater(req.result);
      if (updated !== null) store.put(updated);
    };
  });
}

// --- Feed icons ------------------------------------------------------------

// The icon record for a feed icon id, or undefined.
export async function getIcon(id) {
  const db = await openDB();
  const txn = db.transaction(STORE_ICONS, "readonly");
  const store = txn.objectStore(STORE_ICONS);
  return new Promise((resolve, reject) => {
    txn.onerror = () => reject(txn.error);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
  });
}

// Store or replace the icon record for a feed icon id.
export async function setIcon(id, value) {
  const db = await openDB();
  const txn = db.transaction(STORE_ICONS, "readwrite");
  const store = txn.objectStore(STORE_ICONS);
  return new Promise((resolve, reject) => {
    txn.onerror = () => reject(txn.error);
    txn.oncomplete = () => resolve();
    store.put({ ...value, id });
  });
}

// All stored icon records.
export async function listIcons() {
  const db = await openDB();
  const txn = db.transaction(STORE_ICONS, "readonly");
  const store = txn.objectStore(STORE_ICONS);
  return new Promise((resolve, reject) => {
    txn.onerror = () => reject(txn.error);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
  });
}

// Delete the icon records with the given ids.
export async function deleteIcons(ids) {
  const db = await openDB();
  const txn = db.transaction(STORE_ICONS, "readwrite");
  const store = txn.objectStore(STORE_ICONS);
  return new Promise((resolve, reject) => {
    txn.onerror = () => reject(txn.error);
    txn.oncomplete = () => resolve();
    for (const id of ids) store.delete(id);
  });
}

// Remove all stored icons (manual "clear cached icons" action).
export async function clearIcons() {
  const db = await openDB();
  const txn = db.transaction(STORE_ICONS, "readwrite");
  const store = txn.objectStore(STORE_ICONS);
  return new Promise((resolve, reject) => {
    txn.onerror = () => reject(txn.error);
    txn.oncomplete = () => resolve();
    store.clear();
  });
}
