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

// --- handleMessage tests ---

test("handleMessage routes mark entries as read message", async () => {
  const message = {
    action: MESSAGE_MARK_ENTRY_IDS_AS_READ,
    entryIds: [1, 2],
  };
  const result = handleMessage(message);
  expect(result).toBeTruthy();
  try {
    await result;
  } catch {
    // Expected to fail due to missing request mock
  }
});

test("handleMessage routes toggle bookmark message", async () => {
  const message = {
    action: MESSAGE_TOGGLE_ENTRY_BOOKMARK,
    entryId: 1,
  };
  const result = handleMessage(message);
  expect(result).toBeTruthy();
  try {
    await result;
  } catch {
    // Expected to fail due to missing request mock
  }
});

test("handleMessage returns false for unknown message", () => {
  const message = {
    action: "unknown_action",
  };
  const result = handleMessage(message);
  expect(result).toBe(false);
});

// --- markEntriesAsRead tests ---

test("markEntriesAsRead removes entries from storage optimistically", async () => {
  const originalGet = browser.storage.local.get;
  const originalSet = browser.storage.local.set;
  const optimisticSets = [];

  browser.storage.local.get = () => {
    return Promise.resolve({ entries: [...testEntries] });
  };
  browser.storage.local.set = (data) => {
    if (data.entries) {
      optimisticSets.push(data.entries);
    }
    return Promise.resolve();
  };

  try {
    await markEntriesAsRead([1, 2]);
  } catch {
    // Expected to fail due to request failing, but optimistic update happened
  }

  expect(optimisticSets.length).toBe(2);
  const firstSet = optimisticSets[0];
  expect(firstSet.length).toBe(1);
  expect(firstSet[0].id).toBe(3);

  browser.storage.local.get = originalGet;
  browser.storage.local.set = originalSet;
});

test("markEntriesAsRead reverts on API failure", async () => {
  const originalGet = browser.storage.local.get;
  const originalSet = browser.storage.local.set;
  const optimisticSets = [];

  browser.storage.local.get = () => {
    return Promise.resolve({ entries: [...testEntries] });
  };
  browser.storage.local.set = (data) => {
    if (data.entries) {
      optimisticSets.push(data.entries);
    }
    return Promise.resolve();
  };

  try {
    await markEntriesAsRead([1, 2]);
  } catch {
    // Expected to fail
  }

  expect(optimisticSets.length).toBe(2);
  const revertedSet = optimisticSets[1];
  expect(revertedSet.length).toBe(3);

  browser.storage.local.get = originalGet;
  browser.storage.local.set = originalSet;
});

test("markEntriesAsRead handles empty entry IDs", async () => {
  const originalGet = browser.storage.local.get;
  const originalSet = browser.storage.local.set;
  const optimisticSets = [];

  browser.storage.local.get = () => {
    return Promise.resolve({ entries: [...testEntries] });
  };
  browser.storage.local.set = (data) => {
    if (data.entries) {
      optimisticSets.push(data.entries);
    }
    return Promise.resolve();
  };

  try {
    await markEntriesAsRead([]);
  } catch {
    // Expected to fail
  }

  expect(optimisticSets.length).toBe(2);
  expect(optimisticSets[0].length).toBe(3);

  browser.storage.local.get = originalGet;
  browser.storage.local.set = originalSet;
});

test("markEntriesAsRead handles missing entries in storage", async () => {
  const originalGet = browser.storage.local.get;
  const originalSet = browser.storage.local.set;
  const optimisticSets = [];

  browser.storage.local.get = () => {
    return Promise.resolve({});
  };
  browser.storage.local.set = (data) => {
    if (data.entries) {
      optimisticSets.push(data.entries);
    }
    return Promise.resolve();
  };

  try {
    await markEntriesAsRead([1]);
  } catch {
    // Expected to fail
  }

  expect(optimisticSets.length).toBe(2);
  expect(optimisticSets[0].length).toBe(0);

  browser.storage.local.get = originalGet;
  browser.storage.local.set = originalSet;
});

test("markEntriesAsRead marks single entry as read", async () => {
  const originalGet = browser.storage.local.get;
  const originalSet = browser.storage.local.set;
  const optimisticSets = [];

  browser.storage.local.get = () => {
    return Promise.resolve({ entries: [...testEntries] });
  };
  browser.storage.local.set = (data) => {
    if (data.entries) {
      optimisticSets.push(data.entries);
    }
    return Promise.resolve();
  };

  try {
    await markEntriesAsRead([2]);
  } catch {
    // Expected to fail
  }

  expect(optimisticSets.length).toBe(2);
  const firstSet = optimisticSets[0];
  expect(firstSet.length).toBe(2);
  expect(firstSet[0].id).toBe(1);
  expect(firstSet[1].id).toBe(3);

  browser.storage.local.get = originalGet;
  browser.storage.local.set = originalSet;
});

// --- toggleBookmark tests ---

test("toggleBookmark toggles starred status from false to true", async () => {
  const originalGet = browser.storage.local.get;
  const originalSet = browser.storage.local.set;
  const optimisticSets = [];

  browser.storage.local.get = () => {
    return Promise.resolve({ entries: [...testEntries] });
  };
  browser.storage.local.set = (data) => {
    if (data.entries) {
      optimisticSets.push(data.entries);
    }
    return Promise.resolve();
  };

  try {
    await toggleBookmark(1);
  } catch {
    // Expected to fail due to request failing
  }

  expect(optimisticSets.length).toBe(2);
  const entry1 = optimisticSets[0].find((e) => e.id === 1);
  expect(entry1.starred).toBe(true);

  browser.storage.local.get = originalGet;
  browser.storage.local.set = originalSet;
});

test("toggleBookmark toggles starred status from true to false", async () => {
  const originalGet = browser.storage.local.get;
  const originalSet = browser.storage.local.set;
  const optimisticSets = [];

  browser.storage.local.get = () => {
    return Promise.resolve({ entries: [...testEntries] });
  };
  browser.storage.local.set = (data) => {
    if (data.entries) {
      optimisticSets.push(data.entries);
    }
    return Promise.resolve();
  };

  try {
    await toggleBookmark(2);
  } catch {
    // Expected to fail due to request failing
  }

  expect(optimisticSets.length).toBe(2);
  const entry2 = optimisticSets[0].find((e) => e.id === 2);
  expect(entry2.starred).toBe(false);

  browser.storage.local.get = originalGet;
  browser.storage.local.set = originalSet;
});

test("toggleBookmark does nothing for non-existent entry", async () => {
  const originalGet = browser.storage.local.get;
  const originalSet = browser.storage.local.set;
  let setCalled = false;

  browser.storage.local.get = () => {
    return Promise.resolve({ entries: [...testEntries] });
  };
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
  const optimisticSets = [];

  browser.storage.local.get = () => {
    return Promise.resolve({ entries: [...testEntries] });
  };
  browser.storage.local.set = (data) => {
    if (data.entries) {
      optimisticSets.push(data.entries);
    }
    return Promise.resolve();
  };

  try {
    await toggleBookmark(1);
  } catch {
    // Expected to fail
  }

  expect(optimisticSets.length).toBe(2);
  const entry2 = optimisticSets[0].find((e) => e.id === 2);
  expect(entry2.starred).toBe(true);
  const entry3 = optimisticSets[0].find((e) => e.id === 3);
  expect(entry3.starred).toBe(false);

  browser.storage.local.get = originalGet;
  browser.storage.local.set = originalSet;
});

test("toggleBookmark handles missing entries in storage", async () => {
  const originalGet = browser.storage.local.get;
  const originalSet = browser.storage.local.set;

  browser.storage.local.get = () => {
    return Promise.resolve({});
  };
  browser.storage.local.set = () => {
    return Promise.resolve();
  };

  const result = await toggleBookmark(1);
  expect(result).toBeFalsy();

  browser.storage.local.get = originalGet;
  browser.storage.local.set = originalSet;
});
