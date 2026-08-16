/* global test, expect, browser, resetDOM */

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
  const sets = [];
  mockStorageAndFetch(t, {
    get: storageGet(testEntries),
    set: recordingSet(sets),
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

test("markEntriesAsRead handles empty entry IDs", async (t) => {
  const sets = [];
  mockStorageAndFetch(t, {
    get: storageGet(testEntries),
    set: recordingSet(sets),
    fetch: okFetch,
  });

  const result = await markEntriesAsRead([]);
  expect(result.length).toBe(3);
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
  const sets = [];
  mockStorageAndFetch(t, {
    get: storageGet(testEntries),
    set: recordingSet(sets),
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

// --- handleStartup tests ---

test("handleStartup opens settings silently when credentials are missing", async (t) => {
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

test("handleStartup throws non-credential errors", async (t) => {
  t.mock.method(browser.storage.local, "get", () => Promise.resolve({}));
  t.mock.method(browser.action, "setPopup", () => {
    throw new Error("unexpected action error");
  });

  let caughtError = null;
  try {
    await handleStartup();
  } catch (error) {
    caughtError = error;
  }

  expect(caughtError).toBeTruthy();
  expect(caughtError.message).toBe("unexpected action error");
});
