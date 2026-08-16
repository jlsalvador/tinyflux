/* global test, expect, browser, resetDOM, document */

import {
  filterVisibleEntries,
  groupEntriesByFeed,
  InvalidUrlOrTokenError,
  refreshAlarm,
  refreshTheme,
  updateBadge,
  validateCredentials,
} from "./common.js";

test("validateCredentials does not throw for valid URL and token", () => {
  validateCredentials("https://example.com", "abc123");
});

test("validateCredentials throws when URL is empty", () => {
  expect(() => validateCredentials("", "abc123")).toThrow(
    InvalidUrlOrTokenError,
  );
});

test("validateCredentials throws when token is empty", () => {
  expect(() => validateCredentials("https://example.com", "")).toThrow(
    InvalidUrlOrTokenError,
  );
});

test("validateCredentials throws when both URL and token are empty", () => {
  expect(() => validateCredentials("", "")).toThrow(InvalidUrlOrTokenError);
});

test("validateCredentials throws when URL is undefined", () => {
  expect(() => validateCredentials(undefined, "abc123")).toThrow(
    InvalidUrlOrTokenError,
  );
});

test("validateCredentials throws when token is undefined", () => {
  expect(() => validateCredentials("https://example.com", undefined)).toThrow(
    InvalidUrlOrTokenError,
  );
});

test("validateCredentials throws when URL is null", () => {
  expect(() => validateCredentials(null, "abc123")).toThrow(
    InvalidUrlOrTokenError,
  );
});

test("validateCredentials throws when token is null", () => {
  expect(() => validateCredentials("https://example.com", null)).toThrow(
    InvalidUrlOrTokenError,
  );
});

test("validateCredentials throws with default message", () => {
  const error = expect(() => validateCredentials("", "")).toThrow(
    InvalidUrlOrTokenError,
  );
  expect(error.message).toBe("You must configure your Miniflux URL and token");
});

test("validateCredentials accepts URL with trailing slash and path", () => {
  validateCredentials("https://example.com/", "token-with-dash");
  validateCredentials("https://example.com/subpath", "token");
});

// --- filterVisibleEntries tests ---

test("filterVisibleEntries hides entries from hidden feeds", () => {
  const entries = [
    {
      id: 1,
      feed: { hide_globally: false, category: { hide_globally: false } },
    },
    {
      id: 2,
      feed: { hide_globally: true, category: { hide_globally: false } },
    },
    {
      id: 3,
      feed: { hide_globally: false, category: { hide_globally: true } },
    },
  ];
  const visible = filterVisibleEntries(entries);
  expect(visible.length).toBe(1);
  expect(visible[0].id).toBe(1);
});

test("filterVisibleEntries handles null/undefined feed gracefully", () => {
  const entries = [
    {
      id: 1,
      feed: { hide_globally: false, category: { hide_globally: false } },
    },
    { id: 2, feed: null },
    { id: 3 },
  ];
  const visible = filterVisibleEntries(entries);
  expect(visible.length).toBe(1);
  expect(visible[0].id).toBe(1);
});

test("filterVisibleEntries returns all when none hidden", () => {
  const entries = [
    {
      id: 1,
      feed: { hide_globally: false, category: { hide_globally: false } },
    },
    {
      id: 2,
      feed: { hide_globally: false, category: { hide_globally: false } },
    },
  ];
  const visible = filterVisibleEntries(entries);
  expect(visible.length).toBe(2);
});

test("filterVisibleEntries returns empty when all hidden", () => {
  const entries = [
    {
      id: 1,
      feed: { hide_globally: true, category: { hide_globally: false } },
    },
    {
      id: 2,
      feed: { hide_globally: false, category: { hide_globally: true } },
    },
  ];
  const visible = filterVisibleEntries(entries);
  expect(visible.length).toBe(0);
});

test("filterVisibleEntries returns empty for empty array", () => {
  const visible = filterVisibleEntries([]);
  expect(visible.length).toBe(0);
});

test("filterVisibleEntries handles entry with no category on feed", () => {
  const entries = [
    {
      id: 1,
      feed: { hide_globally: false },
    },
    {
      id: 2,
      feed: { hide_globally: false, category: null },
    },
    {
      id: 3,
      feed: { hide_globally: false, category: { hide_globally: false } },
    },
  ];
  const visible = filterVisibleEntries(entries);
  expect(visible.length).toBe(1);
  expect(visible[0].id).toBe(3);
});

test("filterVisibleEntries handles both feed and category hidden", () => {
  const entries = [
    {
      id: 1,
      feed: { hide_globally: true, category: { hide_globally: true } },
    },
  ];
  const visible = filterVisibleEntries(entries);
  expect(visible.length).toBe(0);
});

test("filterVisibleEntries preserves entry order", () => {
  const entries = [
    {
      id: 3,
      feed: { hide_globally: false, category: { hide_globally: false } },
    },
    {
      id: 1,
      feed: { hide_globally: false, category: { hide_globally: false } },
    },
    {
      id: 4,
      feed: { hide_globally: false, category: { hide_globally: false } },
    },
  ];
  const visible = filterVisibleEntries(entries);
  expect(visible.map((e) => e.id)).toEqual([3, 1, 4]);
});

// --- groupEntriesByFeed tests ---

test("groupEntriesByFeed groups entries by feed title", async () => {
  const entries = [
    {
      title: "Entry 1",
      feed: { title: "Feed A" },
    },
    {
      title: "Entry 2",
      feed: { title: "Feed B" },
    },
    {
      title: "Entry 3",
      feed: { title: "Feed A" },
    },
  ];
  const grouped = await groupEntriesByFeed(entries);
  expect(grouped["Feed A"].length).toBe(2);
  expect(grouped["Feed A"][0]).toBe("Entry 1");
  expect(grouped["Feed A"][1]).toBe("Entry 3");
  expect(grouped["Feed B"].length).toBe(1);
  expect(grouped["Feed B"][0]).toBe("Entry 2");
});

test("groupEntriesByFeed handles missing feed title", async () => {
  const entries = [
    {
      title: "Orphan Entry",
      feed: {},
    },
  ];
  const grouped = await groupEntriesByFeed(entries);
  expect(Object.keys(grouped).length).toBe(1);
});

test("groupEntriesByFeed returns empty object for empty array", async () => {
  const grouped = await groupEntriesByFeed([]);
  expect(Object.keys(grouped).length).toBe(0);
});

test("groupEntriesByFeed handles single feed", async () => {
  const entries = [
    {
      title: "A",
      feed: { title: "Tech" },
    },
    {
      title: "B",
      feed: { title: "Tech" },
    },
    {
      title: "C",
      feed: { title: "Tech" },
    },
  ];
  const grouped = await groupEntriesByFeed(entries);
  expect(grouped["Tech"].length).toBe(3);
});

// --- refreshTheme tests ---

test("refreshTheme sets data-theme attribute on document", async () => {
  resetDOM("<!doctype html><html><head></head><body></body></html>");
  await refreshTheme();
  const theme = document.documentElement.getAttribute("data-theme");
  expect(theme).toBeTruthy();
});

test("refreshTheme uses default theme when none stored", async () => {
  resetDOM("<!doctype html><html><head></head><body></body></html>");
  await refreshTheme();
  const theme = document.documentElement.getAttribute("data-theme");
  expect(theme).toBe("light");
});

// --- refreshAlarm tests ---

test("refreshAlarm creates alarm with default period", async () => {
  let alarmCreated = false;
  const originalCreate = browser.alarms.create;
  browser.alarms.create = (name, options) => {
    alarmCreated = true;
    expect(name).toBe("ALARM_REFRESH");
    expect(options.periodInMinutes).toBe(15);
    return Promise.resolve();
  };

  try {
    await refreshAlarm();
  } finally {
    browser.alarms.create = originalCreate;
  }
  expect(alarmCreated).toBe(true);
});

test("refreshAlarm uses stored period when available", async () => {
  let alarmCreated = false;
  const originalCreate = browser.alarms.create;
  const originalGet = browser.storage.local.get;
  browser.alarms.create = (name, options) => {
    alarmCreated = true;
    expect(options.periodInMinutes).toBe(30);
    return Promise.resolve();
  };
  browser.storage.local.get = (keys) => {
    if (
      keys === "periodInMinutes" ||
      (Array.isArray(keys) && keys.includes("periodInMinutes"))
    ) {
      return Promise.resolve({ periodInMinutes: 30 });
    }
    return originalGet(keys);
  };

  try {
    await refreshAlarm();
  } finally {
    browser.alarms.create = originalCreate;
    browser.storage.local.get = originalGet;
  }
  expect(alarmCreated).toBe(true);
});

test("refreshAlarm falls back to default for invalid period", async () => {
  let alarmCreated = false;
  const originalCreate = browser.alarms.create;
  const originalGet = browser.storage.local.get;
  browser.alarms.create = (name, options) => {
    alarmCreated = true;
    expect(options.periodInMinutes).toBe(15);
    return Promise.resolve();
  };
  browser.storage.local.get = (keys) => {
    if (
      keys === "periodInMinutes" ||
      (Array.isArray(keys) && keys.includes("periodInMinutes"))
    ) {
      return Promise.resolve({ periodInMinutes: null });
    }
    return originalGet(keys);
  };

  try {
    await refreshAlarm();
  } finally {
    browser.alarms.create = originalCreate;
    browser.storage.local.get = originalGet;
  }
  expect(alarmCreated).toBe(true);
});

// --- updateBadge tests ---

test("updateBadge sets empty badge text when no entries", async () => {
  let badgeText = null;
  const originalSetBadgeText = browser.action.setBadgeText;
  const originalGet = browser.storage.local.get;
  browser.action.setBadgeText = (options) => {
    badgeText = options.text;
    return Promise.resolve();
  };
  browser.storage.local.get = (keys) => {
    if (
      keys === "entries" ||
      (Array.isArray(keys) && keys.includes("entries"))
    ) {
      return Promise.resolve({ entries: [] });
    }
    return originalGet(keys);
  };

  try {
    await updateBadge();
  } finally {
    browser.action.setBadgeText = originalSetBadgeText;
    browser.storage.local.get = originalGet;
  }
  expect(badgeText).toBe("");
});

test("updateBadge sets badge text to entry count", async () => {
  let badgeText = null;
  const originalSetBadgeText = browser.action.setBadgeText;
  const originalGet = browser.storage.local.get;
  const entries = [
    {
      id: 1,
      feed: { hide_globally: false, category: { hide_globally: false } },
    },
    {
      id: 2,
      feed: { hide_globally: false, category: { hide_globally: false } },
    },
  ];
  browser.action.setBadgeText = (options) => {
    badgeText = options.text;
    return Promise.resolve();
  };
  browser.storage.local.get = (keys) => {
    if (
      keys === "entries" ||
      (Array.isArray(keys) && keys.includes("entries"))
    ) {
      return Promise.resolve({ entries });
    }
    return originalGet(keys);
  };

  try {
    await updateBadge();
  } finally {
    browser.action.setBadgeText = originalSetBadgeText;
    browser.storage.local.get = originalGet;
  }
  expect(badgeText).toBe("2");
});

test("updateBadge excludes hidden feed entries from count", async () => {
  let badgeText = null;
  const originalSetBadgeText = browser.action.setBadgeText;
  const originalGet = browser.storage.local.get;
  const entries = [
    {
      id: 1,
      feed: { hide_globally: false, category: { hide_globally: false } },
    },
    {
      id: 2,
      feed: { hide_globally: true, category: { hide_globally: false } },
    },
  ];
  browser.action.setBadgeText = (options) => {
    badgeText = options.text;
    return Promise.resolve();
  };
  browser.storage.local.get = (keys) => {
    if (
      keys === "entries" ||
      (Array.isArray(keys) && keys.includes("entries"))
    ) {
      return Promise.resolve({ entries });
    }
    return originalGet(keys);
  };

  try {
    await updateBadge();
  } finally {
    browser.action.setBadgeText = originalSetBadgeText;
    browser.storage.local.get = originalGet;
  }
  expect(badgeText).toBe("1");
});
