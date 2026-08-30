/* global queueMicrotask structuredClone */

// In-memory IndexedDB mock for tests.
//
// Implements just enough of the IDB API surface that src/pages/db.js uses:
//   indexedDB.open(name, version) -> IDBOpenDBRequest
//   IDBOpenDBRequest.onupgradeneeded / .onsuccess / .onserror / .result
//   IDBDatabase.createObjectStore(name, { keyPath }) / .objectStoreNames
//     / .transaction(storeNames, mode)
//   IDBTransaction.objectStore(name) / .oncomplete / .onerror
//   IDBObjectStore.get / .getAll / .put / .delete / .clear -> IDBRequest
//   IDBRequest.onsuccess / .result
//
// Request results are delivered asynchronously via queueMicrotask, mirroring
// the browser. A transaction's oncomplete fires (via a further microtask) only
// once every request issued within it — including requests issued from an
// earlier request's onsuccess handler, which is how db.js chains multi-request
// transactions — has settled.
//
// Records are structured-cloned on get/put/getAll so the store never aliases
// caller objects, matching real IDB semantics.

const databases = new Map(); // name -> MockDatabase
const allStores = []; // every MockStore ever created, for __resetIDB

class IDBRequest {
  constructor(txn = null) {
    this.result = undefined;
    this.error = undefined;
    this.onsuccess = null;
    this.onerror = null;
    this._txn = txn;
  }

  // Schedule result delivery. Runs the success handler, then lets the owning
  // transaction settle (which may fire oncomplete).
  _resolve(value) {
    const txn = this._txn;
    this.result = value;
    queueMicrotask(() => {
      if (this.onsuccess) this.onsuccess({ target: this });
      if (txn) txn._settle();
    });
  }
}

class MockStore {
  constructor(name, keyPath) {
    this.name = name;
    this.keyPath = keyPath;
    this.records = new Map();
    this._txn = null;
    allStores.push(this);
  }

  _bindTxn(txn) {
    this._txn = txn;
  }

  _request() {
    const req = new IDBRequest(this._txn);
    if (this._txn) this._txn._issue();
    return req;
  }

  get(key) {
    const req = this._request();
    const stored = this.records.get(key);
    req._resolve(stored === undefined ? undefined : structuredClone(stored));
    return req;
  }

  getAll() {
    const req = this._request();
    req._resolve([...this.records.values()].map((v) => structuredClone(v)));
    return req;
  }

  put(value) {
    const req = this._request();
    const key = value[this.keyPath];
    this.records.set(key, structuredClone(value));
    req._resolve(key);
    return req;
  }

  delete(key) {
    const req = this._request();
    this.records.delete(key);
    req._resolve(undefined);
    return req;
  }

  clear() {
    const req = this._request();
    this.records.clear();
    req._resolve(undefined);
    return req;
  }
}

class MockTransaction {
  constructor(db, storeNames, mode) {
    this.db = db;
    this.objectStoreNames = storeNames;
    this.mode = mode;
    this.error = undefined;
    this.oncomplete = null;
    this.onerror = null;
    this.onabort = null;
    this._pending = 0;
    this._done = false;
  }

  objectStore(name) {
    const store = this.db.stores.get(name);
    store._bindTxn(this);
    return store;
  }

  _issue() {
    this._pending += 1;
  }

  _settle() {
    if (this._done) return;
    this._pending -= 1;
    if (this._pending === 0) {
      this._done = true;
      queueMicrotask(() => {
        if (this.oncomplete) this.oncomplete({ target: this });
      });
    }
  }
}

class MockDatabase {
  constructor(name) {
    this.name = name;
    this.stores = new Map();
    this.objectStoreNames = {
      contains: (n) => this.stores.has(n),
    };
  }

  createObjectStore(name, options = {}) {
    const store = new MockStore(name, options.keyPath);
    this.stores.set(name, store);
    return store;
  }

  transaction(storeNames, mode = "readwrite") {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    return new MockTransaction(this, names, mode);
  }
}

function open(name) {
  const req = new IDBRequest(null);
  queueMicrotask(() => {
    const isNew = !databases.has(name);
    let db = databases.get(name);
    if (isNew) {
      db = new MockDatabase(name);
      databases.set(name, db);
    }
    req.result = db;
    if (isNew && req.onupgradeneeded) {
      req.onupgradeneeded({ target: req, result: db });
    }
    if (req.onsuccess) req.onsuccess({ target: req, result: db });
  });
  return req;
}

// Clear every record in every store. The database object itself is kept so
// db.js's cached open() promise stays valid across tests in the same process.
function __resetIDB() {
  for (const store of allStores) store.records.clear();
}

globalThis.indexedDB = { open };
export { __resetIDB };
