/* global test, expect, browser */

import {
  markEntriesAsRead,
  toggleBookmark,
  handleMessage,
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

// --- handleMessage tests ---

test("handleMessage routes mark entries as read message", async () => {
  const originalGet = browser.storage.local.get;
  const originalSet = browser.storage.local.set;
  const originalFetch = globalThis.fetch;

  browser.storage.local.get = () =>
    Promise.resolve({
      entries: [...testEntries],
      ...credentials,
    });
  browser.storage.local.set = () => Promise.resolve();
  globalThis.fetch = () =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    });

  const message = {
    action: MESSAGE_MARK_ENTRY_IDS_AS_READ,
    entryIds: [1, 2],
  };
  const result = await handleMessage(message);
  expect(result).toBeTruthy();

  browser.storage.local.get = originalGet;
  browser.storage.local.set = originalSet;
  globalThis.fetch = originalFetch;
});

test("handleMessage routes toggle bookmark message", async () => {
  const originalGet = browser.storage.local.get;
  const originalSet = browser.storage.local.set;
  const originalFetch = globalThis.fetch;

  browser.storage.local.get = () =>
    Promise.resolve({
      entries: [...testEntries],
      ...credentials,
    });
  browser.storage.local.set = () => Promise.resolve();
  globalThis.fetch = () =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    });

  const message = {
    action: MESSAGE_TOGGLE_ENTRY_BOOKMARK,
    entryId: 1,
  };
  const result = await handleMessage(message);
  expect(result).toBeTruthy();

  browser.storage.local.get = originalGet;
  browser.storage.local.set = originalSet;
  globalThis.fetch = originalFetch;
});

test("handleMessage returns false for unknown message", async () => {
  const message = {
    action: "unknown_action",
  };
  const result = await handleMessage(message);
  expect(result).toBe(false);
});

// --- markEntriesAsRead tests ---

test("markEntriesAsRead removes entries from storage optimistically", async () => {
  const originalGet = browser.storage.local.get;
  const originalSet = browser.storage.local.set;
  const originalFetch = globalThis.fetch;
  const optimisticSets = [];

  browser.storage.local.get = () =>
    Promise.resolve({
      entries: [...testEntries],
      ...credentials,
    });
  browser.storage.local.set = (data) => {
    if (data.entries) {
      optimisticSets.push(data.entries);
    }
    return Promise.resolve();
  };
  globalThis.fetch = () =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    });

  const result = await markEntriesAsRead([1, 2]);
  expect(result.length).toBe(1);
  expect(result[0].id).toBe(3);
  expect(optimisticSets.length).toBe(1);

  browser.storage.local.get = originalGet;
  browser.storage.local.set = originalSet;
  globalThis.fetch = originalFetch;
});

test("markEntriesAsRead reverts on API failure", async () => {
  const originalGet = browser.storage.local.get;
  const originalSet = browser.storage.local.set;
  const originalFetch = globalThis.fetch;
  const optimisticSets = [];

  browser.storage.local.get = () =>
    Promise.resolve({
      entries: [...testEntries],
      ...credentials,
    });
  browser.storage.local.set = (data) => {
    if (data.entries) {
      optimisticSets.push(data.entries);
    }
    return Promise.resolve();
  };
  globalThis.fetch = () => Promise.reject(new Error("API error"));

  let caughtError = null;
  try {
    await markEntriesAsRead([1, 2]);
  } catch (error) {
    caughtError = error;
  }
  expect(caughtError).toBeTruthy();
  expect(caughtError.message).toBe(
    "Error while marking the entry as read, reverting",
  );
  expect(caughtError.cause.message).toBe("API error");
  expect(optimisticSets.length).toBe(2);
  const revertedSet = optimisticSets[1];
  expect(revertedSet.length).toBe(3);

  browser.storage.local.get = originalGet;
  browser.storage.local.set = originalSet;
  globalThis.fetch = originalFetch;
});

test("markEntriesAsRead handles empty entry IDs", async () => {
  const originalGet = browser.storage.local.get;
  const originalSet = browser.storage.local.set;
  const originalFetch = globalThis.fetch;
  const optimisticSets = [];

  browser.storage.local.get = () =>
    Promise.resolve({
      entries: [...testEntries],
      ...credentials,
    });
  browser.storage.local.set = (data) => {
    if (data.entries) {
      optimisticSets.push(data.entries);
    }
    return Promise.resolve();
  };
  globalThis.fetch = () =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    });

  const result = await markEntriesAsRead([]);
  expect(result.length).toBe(3);
  expect(optimisticSets.length).toBe(1);

  browser.storage.local.get = originalGet;
  browser.storage.local.set = originalSet;
  globalThis.fetch = originalFetch;
});

test("markEntriesAsRead handles missing entries in storage", async () => {
  const originalGet = browser.storage.local.get;
  const originalSet = browser.storage.local.set;
  const originalFetch = globalThis.fetch;
  const optimisticSets = [];

  browser.storage.local.get = () =>
    Promise.resolve({
      ...credentials,
    });
  browser.storage.local.set = (data) => {
    if (data.entries) {
      optimisticSets.push(data.entries);
    }
    return Promise.resolve();
  };
  globalThis.fetch = () =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    });

  const result = await markEntriesAsRead([1]);
  expect(result.length).toBe(0);
  expect(optimisticSets.length).toBe(1);

  browser.storage.local.get = originalGet;
  browser.storage.local.set = originalSet;
  globalThis.fetch = originalFetch;
});

test("markEntriesAsRead marks single entry as read", async () => {
  const originalGet = browser.storage.local.get;
  const originalSet = browser.storage.local.set;
  const originalFetch = globalThis.fetch;
  const optimisticSets = [];

  browser.storage.local.get = () =>
    Promise.resolve({
      entries: [...testEntries],
      ...credentials,
    });
  browser.storage.local.set = (data) => {
    if (data.entries) {
      optimisticSets.push(data.entries);
    }
    return Promise.resolve();
  };
  globalThis.fetch = () =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    });

  const result = await markEntriesAsRead([2]);
  expect(result.length).toBe(2);
  expect(result[0].id).toBe(1);
  expect(result[1].id).toBe(3);
  expect(optimisticSets.length).toBe(1);

  browser.storage.local.get = originalGet;
  browser.storage.local.set = originalSet;
  globalThis.fetch = originalFetch;
});

// --- toggleBookmark tests ---

test("toggleBookmark toggles starred status from false to true", async () => {
  const originalGet = browser.storage.local.get;
  const originalSet = browser.storage.local.set;
  const originalFetch = globalThis.fetch;
  const optimisticSets = [];

  browser.storage.local.get = () =>
    Promise.resolve({
      entries: [...testEntries],
      ...credentials,
    });
  browser.storage.local.set = (data) => {
    if (data.entries) {
      optimisticSets.push(data.entries);
    }
    return Promise.resolve();
  };
  globalThis.fetch = () =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    });

  const result = await toggleBookmark(1);
  const entry1 = result.find((e) => e.id === 1);
  expect(entry1.starred).toBe(true);
  expect(optimisticSets.length).toBe(1);

  browser.storage.local.get = originalGet;
  browser.storage.local.set = originalSet;
  globalThis.fetch = originalFetch;
});

test("toggleBookmark toggles starred status from true to false", async () => {
  const originalGet = browser.storage.local.get;
  const originalSet = browser.storage.local.set;
  const originalFetch = globalThis.fetch;
  const optimisticSets = [];

  browser.storage.local.get = () =>
    Promise.resolve({
      entries: [...testEntries],
      ...credentials,
    });
  browser.storage.local.set = (data) => {
    if (data.entries) {
      optimisticSets.push(data.entries);
    }
    return Promise.resolve();
  };
  globalThis.fetch = () =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    });

  const result = await toggleBookmark(2);
  const entry2 = result.find((e) => e.id === 2);
  expect(entry2.starred).toBe(false);
  expect(optimisticSets.length).toBe(1);

  browser.storage.local.get = originalGet;
  browser.storage.local.set = originalSet;
  globalThis.fetch = originalFetch;
});

test("toggleBookmark does nothing for non-existent entry", async () => {
  const originalGet = browser.storage.local.get;
  const originalSet = browser.storage.local.set;
  let setCalled = false;

  browser.storage.local.get = () =>
    Promise.resolve({
      entries: [...testEntries],
      ...credentials,
    });
  browser.storage.local.set = () => {
    setCalled = true;
    return Promise.resolve();
  };

  const result = await toggleBookmark(999);
  expect(result).toBeFalsy();
  expect(setCalled).toBe(false);

  browser.storage.local.get = originalGet;
  browser.storage.local.set = originalSet;
});

test("toggleBookmark preserves other entries unchanged", async () => {
  const originalGet = browser.storage.local.get;
  const originalSet = browser.storage.local.set;
  const originalFetch = globalThis.fetch;
  const optimisticSets = [];

  browser.storage.local.get = () =>
    Promise.resolve({
      entries: [...testEntries],
      ...credentials,
    });
  browser.storage.local.set = (data) => {
    if (data.entries) {
      optimisticSets.push(data.entries);
    }
    return Promise.resolve();
  };
  globalThis.fetch = () =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    });

  const result = await toggleBookmark(1);
  const entry2 = result.find((e) => e.id === 2);
  expect(entry2.starred).toBe(true);
  const entry3 = result.find((e) => e.id === 3);
  expect(entry3.starred).toBe(false);
  expect(optimisticSets.length).toBe(1);

  browser.storage.local.get = originalGet;
  browser.storage.local.set = originalSet;
  globalThis.fetch = originalFetch;
});

test("toggleBookmark handles missing entries in storage", async () => {
  const originalGet = browser.storage.local.get;
  const originalSet = browser.storage.local.set;

  browser.storage.local.get = () =>
    Promise.resolve({
      ...credentials,
    });
  browser.storage.local.set = () => Promise.resolve();

  const result = await toggleBookmark(1);
  expect(result).toBeFalsy();

  browser.storage.local.get = originalGet;
  browser.storage.local.set = originalSet;
});

test("toggleBookmark reverts on API failure", async () => {
  const originalGet = browser.storage.local.get;
  const originalSet = browser.storage.local.set;
  const originalFetch = globalThis.fetch;
  const optimisticSets = [];

  browser.storage.local.get = () =>
    Promise.resolve({
      entries: [...testEntries],
      ...credentials,
    });
  browser.storage.local.set = (data) => {
    if (data.entries) {
      optimisticSets.push(data.entries);
    }
    return Promise.resolve();
  };
  globalThis.fetch = () => Promise.reject(new Error("API error"));

  let caughtError = null;
  try {
    await toggleBookmark(1);
  } catch (error) {
    caughtError = error;
  }
  expect(caughtError).toBeTruthy();
  expect(caughtError.message).toBe("Error bookmarking the entry, reverting");
  expect(caughtError.cause.message).toBe("API error");
  expect(optimisticSets.length).toBe(2);
  const revertedSet = optimisticSets[1];
  const revertedEntry = revertedSet.find((e) => e.id === 1);
  expect(revertedEntry.starred).toBe(false);

  browser.storage.local.get = originalGet;
  browser.storage.local.set = originalSet;
  globalThis.fetch = originalFetch;
});
