/* global test, expect, browser, resetDOM, console */

import {
  markEntriesAsRead,
  toggleBookmark,
  handleMessage,
  handleStartup,
} from "./background.js";
import {
  MESSAGE_MARK_ENTRY_IDS_AS_READ,
  MESSAGE_TOGGLE_ENTRY_BOOKMARK,
} from "./common.js";

const testEntries = [
  {
    id: 1,
    title: "Entry 1",
    starred: false,
  },
  {
    id: 2,
    title: "Entry 2",
    starred: true,
  },
  {
    id: 3,
    title: "Entry 3",
    starred: false,
  },
];

const credentials = {
  url: "https://miniflux.example.com",
  token: "test-api-token",
};

const okFetch = () =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({}) });

const failFetch = () => Promise.reject(new Error("API error"));

// Replace storage/fetch for the duration of a test; node:test restores the
// originals automatically when the test ends.
const mockStorageAndFetch = (t, { get, set, fetch: fetchMock }) => {
  t.mock.method(browser.storage.local, "get", get);
  t.mock.method(browser.storage.local, "set", set);
  t.mock.method(globalThis, "fetch", fetchMock);
};

const storageGet = (entries) => () =>
  Promise.resolve({
    ...(entries ? { entries: [...entries] } : {}),
    ...credentials,
  });

const recordingSet = (record) => (data) => {
  if (data.entries) {
    record.push(data.entries);
  }
  return Promise.resolve();
};

// --- handleMessage tests ---

test("handleMessage routes mark entries as read message", async (t) => {
  const sets = [];
  mockStorageAndFetch(t, {
    get: storageGet(testEntries),
    set: recordingSet(sets),
    fetch: okFetch,
  });

  const message = {
    action: MESSAGE_MARK_ENTRY_IDS_AS_READ,
    entryIds: [1, 2],
  };
  const result = await handleMessage(message);
  expect(result).toBeTruthy();
});

test("handleMessage routes toggle bookmark message", async (t) => {
  const sets = [];
  mockStorageAndFetch(t, {
    get: storageGet(testEntries),
    set: recordingSet(sets),
    fetch: okFetch,
  });

  const message = {
    action: MESSAGE_TOGGLE_ENTRY_BOOKMARK,
    entryId: 1,
  };
  const result = await handleMessage(message);
  expect(result).toBeTruthy();
});

test("handleMessage returns false for unknown message", async () => {
  const message = {
    action: "unknown_action",
  };
  const result = await handleMessage(message);
  expect(result).toBe(false);
});

test("handleMessage returns false when entryIds is missing", async (t) => {
  const sets = [];
  mockStorageAndFetch(t, {
    get: storageGet(testEntries),
    set: recordingSet(sets),
    fetch: okFetch,
  });

  const result = await handleMessage({
    action: MESSAGE_MARK_ENTRY_IDS_AS_READ,
  });
  expect(result).toBe(false);
  expect(sets.length).toBe(0);
});

test("handleMessage returns false when entryId is not a number", async (t) => {
  const sets = [];
  mockStorageAndFetch(t, {
    get: storageGet(testEntries),
    set: recordingSet(sets),
    fetch: okFetch,
  });

  const result = await handleMessage({
    action: MESSAGE_TOGGLE_ENTRY_BOOKMARK,
    entryId: "1",
  });
  expect(result).toBe(false);
  expect(sets.length).toBe(0);
});

// --- markEntriesAsRead tests ---

test("markEntriesAsRead removes entries from storage optimistically", async (t) => {
  const sets = [];
  mockStorageAndFetch(t, {
    get: storageGet(testEntries),
    set: recordingSet(sets),
    fetch: okFetch,
  });

  const result = await markEntriesAsRead([1, 2]);
  expect(result.length).toBe(1);
  expect(result[0].id).toBe(3);
  expect(sets.length).toBe(1);
});

test("markEntriesAsRead reverts on API failure", async (t) => {
  const store = { entries: [...testEntries] };
  const sets = [];
  mockStorageAndFetch(t, {
    get: () => Promise.resolve({ ...store, ...credentials }),
    set: (data) => {
      if (data.entries) {
        sets.push(data.entries);
        store.entries = data.entries;
      }
      return Promise.resolve();
    },
    fetch: failFetch,
  });

  let caughtError = null;
  try {
    await markEntriesAsRead([1, 2]);
  } catch (error) {
    caughtError = error;
  }
  expect(caughtError).toBeTruthy();
  expect(caughtError.message).toBe("Failed to mark entries as read, reverting");
  expect(caughtError.cause.message).toBe("API error");
  expect(sets.length).toBe(2);
  expect(sets[1].length).toBe(3);
});

test("markEntriesAsRead rollback preserves a concurrent refresh", async (t) => {
  const base = [
    { id: 1, title: "A", starred: false },
    { id: 2, title: "B", starred: false },
    { id: 3, title: "C", starred: false },
  ];
  const refreshed = [...base, { id: 4, title: "D", starred: false }];
  let getCall = 0;
  const store = { entries: [...base] };
  const sets = [];
  mockStorageAndFetch(t, {
    get: () => {
      getCall += 1;
      // Simulate a concurrent scheduled refresh landing right after the
      // optimistic read: it re-stores the still-unread entries (entry 1
      // comes back) plus a brand new entry (4).
      if (getCall === 2) {
        store.entries = [...refreshed];
      }
      return Promise.resolve({ ...store, ...credentials });
    },
    set: (data) => {
      if (data.entries) {
        sets.push(data.entries);
        store.entries = data.entries;
      }
      return Promise.resolve();
    },
    fetch: failFetch,
  });

  let caughtError = null;
  try {
    await markEntriesAsRead([1]);
  } catch (error) {
    caughtError = error;
  }

  expect(caughtError).toBeTruthy();
  expect(caughtError.message).toBe("Failed to mark entries as read, reverting");
  // One optimistic write and one rollback merge.
  expect(sets.length).toBe(2);
  expect(sets[0].map((e) => e.id)).toEqual([2, 3, 4]);
  // Entry 1 is restored and the concurrently refreshed entry 4 is kept:
  // the rollback must merge into the latest state, not clobber it.
  expect(sets[1].map((e) => e.id)).toEqual([2, 3, 4, 1]);
});

test("markEntriesAsRead is a no-op for empty entry IDs", async (t) => {
  const sets = [];
  const fetched = [];
  mockStorageAndFetch(t, {
    get: storageGet(testEntries),
    set: recordingSet(sets),
    fetch: (req) => {
      fetched.push(req);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    },
  });

  const result = await markEntriesAsRead([]);
  expect(result).toBe(undefined);
  expect(sets.length).toBe(0);
  expect(fetched.length).toBe(0);
});

test("markEntriesAsRead is a no-op for non-array entry IDs", async (t) => {
  const sets = [];
  mockStorageAndFetch(t, {
    get: storageGet(testEntries),
    set: recordingSet(sets),
    fetch: okFetch,
  });

  const result = await markEntriesAsRead("not-an-array");
  expect(result).toBe(undefined);
  expect(sets.length).toBe(0);
});

test("markEntriesAsRead retries when storage changes concurrently", async (t) => {
  const base = [
    { id: 1, title: "A", starred: false },
    { id: 2, title: "B", starred: false },
    { id: 3, title: "C", starred: false },
  ];
  const concurrent = [...base, { id: 4, title: "D", starred: false }];
  let getCall = 0;
  const sets = [];
  mockStorageAndFetch(t, {
    get: () => {
      getCall += 1;
      // Simulate a concurrent refresh that adds entry D just before the
      // write is validated, forcing a retry on the fresh state.
      const entries = getCall >= 2 ? concurrent : base;
      return Promise.resolve({ entries: [...entries], ...credentials });
    },
    set: recordingSet(sets),
    fetch: okFetch,
  });

  const result = await markEntriesAsRead([1]);

  expect(result.map((e) => e.id)).toEqual([2, 3, 4]);
  expect(sets.length).toBe(1);
});

test("markEntriesAsRead handles missing entries in storage", async (t) => {
  const sets = [];
  mockStorageAndFetch(t, {
    get: storageGet(),
    set: recordingSet(sets),
    fetch: okFetch,
  });

  const result = await markEntriesAsRead([1]);
  expect(result.length).toBe(0);
  expect(sets.length).toBe(1);
});

test("markEntriesAsRead marks single entry as read", async (t) => {
  const sets = [];
  mockStorageAndFetch(t, {
    get: storageGet(testEntries),
    set: recordingSet(sets),
    fetch: okFetch,
  });

  const result = await markEntriesAsRead([2]);
  expect(result.length).toBe(2);
  expect(result[0].id).toBe(1);
  expect(result[1].id).toBe(3);
  expect(sets.length).toBe(1);
});

// --- toggleBookmark tests ---

test("toggleBookmark toggles starred status from false to true", async (t) => {
  const sets = [];
  mockStorageAndFetch(t, {
    get: storageGet(testEntries),
    set: recordingSet(sets),
    fetch: okFetch,
  });

  const result = await toggleBookmark(1);
  const entry1 = result.find((e) => e.id === 1);
  expect(entry1.starred).toBe(true);
  expect(sets.length).toBe(1);
});

test("toggleBookmark toggles starred status from true to false", async (t) => {
  const sets = [];
  mockStorageAndFetch(t, {
    get: storageGet(testEntries),
    set: recordingSet(sets),
    fetch: okFetch,
  });

  const result = await toggleBookmark(2);
  const entry2 = result.find((e) => e.id === 2);
  expect(entry2.starred).toBe(false);
  expect(sets.length).toBe(1);
});

test("toggleBookmark does nothing for non-existent entry", async (t) => {
  const sets = [];
  mockStorageAndFetch(t, {
    get: storageGet(testEntries),
    set: recordingSet(sets),
    fetch: okFetch,
  });

  const result = await toggleBookmark(999);
  expect(result).toBeFalsy();
  expect(sets.length).toBe(0);
});

test("toggleBookmark preserves other entries unchanged", async (t) => {
  const sets = [];
  mockStorageAndFetch(t, {
    get: storageGet(testEntries),
    set: recordingSet(sets),
    fetch: okFetch,
  });

  const result = await toggleBookmark(1);
  const entry2 = result.find((e) => e.id === 2);
  expect(entry2.starred).toBe(true);
  const entry3 = result.find((e) => e.id === 3);
  expect(entry3.starred).toBe(false);
  expect(sets.length).toBe(1);
});

test("toggleBookmark handles missing entries in storage", async (t) => {
  const sets = [];
  mockStorageAndFetch(t, {
    get: storageGet(),
    set: recordingSet(sets),
    fetch: okFetch,
  });

  const result = await toggleBookmark(1);
  expect(result).toBeFalsy();
});

test("toggleBookmark reverts on API failure", async (t) => {
  const store = { entries: [...testEntries] };
  const sets = [];
  mockStorageAndFetch(t, {
    get: () => Promise.resolve({ ...store, ...credentials }),
    set: (data) => {
      if (data.entries) {
        sets.push(data.entries);
        store.entries = data.entries;
      }
      return Promise.resolve();
    },
    fetch: failFetch,
  });

  let caughtError = null;
  try {
    await toggleBookmark(1);
  } catch (error) {
    caughtError = error;
  }
  expect(caughtError).toBeTruthy();
  expect(caughtError.message).toBe("Failed to toggle bookmark, reverting");
  expect(caughtError.cause.message).toBe("API error");
  expect(sets.length).toBe(2);
  const revertedEntry = sets[1].find((e) => e.id === 1);
  expect(revertedEntry.starred).toBe(false);
});

test("toggleBookmark serializes concurrent mutations on the same base state", async (t) => {
  // Mutable store: each mutation must build on the state written by the
  // previous one, so both toggles survive (without serialization, both
  // callers would read the same base state and the second write would drop
  // the first mutation).
  const store = { entries: [...testEntries] };
  const sets = [];
  mockStorageAndFetch(t, {
    get: () => Promise.resolve({ ...store, ...credentials }),
    set: (data) => {
      if (data.entries) {
        sets.push(data.entries);
        store.entries = data.entries;
      }
      return Promise.resolve();
    },
    fetch: okFetch,
  });

  const [resultA, resultB] = await Promise.all([
    toggleBookmark(1),
    toggleBookmark(2),
  ]);

  expect(resultA.find((e) => e.id === 1).starred).toBe(true);
  expect(resultB.find((e) => e.id === 2).starred).toBe(false);
  expect(sets.length).toBe(2);
  const finalState = sets[sets.length - 1];
  expect(finalState.find((e) => e.id === 1).starred).toBe(true);
  expect(finalState.find((e) => e.id === 2).starred).toBe(false);
});

// --- handleStartup tests ---

test("handleStartup opens settings silently when credentials are missing", async (t) => {
  t.mock.method(console, "log", () => {});
  let settingsOpened = false;
  t.mock.method(browser.storage.local, "get", () =>
    Promise.resolve({
      url: "",
      token: "",
    }),
  );
  t.mock.method(browser.runtime, "openOptionsPage", () => {
    settingsOpened = true;
    return Promise.resolve();
  });
  resetDOM("<!doctype html><html><head></head><body></body></html>");

  await handleStartup();
  expect(settingsOpened).toBe(true);
});

test("handleStartup logs non-credential errors without throwing", async (t) => {
  t.mock.method(console, "log", () => {});
  const errors = [];
  t.mock.method(console, "error", (...args) => {
    errors.push(args);
  });
  t.mock.method(browser.storage.local, "get", () => Promise.resolve({}));
  t.mock.method(browser.action, "setPopup", () => {
    throw new Error("unexpected action error");
  });

  let threw = false;
  try {
    await handleStartup();
  } catch {
    threw = true;
  }

  expect(threw).toBe(false);
  expect(errors.length).toBe(1);
  expect(String(errors[0][1])).toContain("unexpected action error");
});
