/* global test, expect, browser, resetDOM, document, console */

import {
  filterVisibleEntries,
  getPopupStyle,
  groupEntriesByFeed,
  InvalidUrlOrTokenError,
  MESSAGE_REFRESH_THEME,
  MESSAGE_REFRESH_VIEW_ENTRIES,
  MinifluxConnectionError,
  notifyRefreshEntries,
  notifyRefreshTheme,
  refreshActionBehavior,
  refreshAlarm,
  refreshEntries,
  refreshTheme,
  request,
  updateBadge,
  updateBadgeColor,
  updateBadgeConnectionError,
  validateCredentials,
} from "./common.js";

// Replace browser.storage.local for the duration of a test. `get` answers
// from the seeded `data` object (absent keys stay absent, like the real API)
// and every `set` call is recorded and returned. Originals are restored
// automatically when the test ends.
const mockStorage = (t, data = {}) => {
  const sets = [];
  t.mock.method(browser.storage.local, "get", (keys) => {
    const keyList = Array.isArray(keys) ? keys : [keys];
    const result = {};
    for (const key of keyList) {
      if (key in data) {
        result[key] = data[key];
      }
    }
    return Promise.resolve(result);
  });
  t.mock.method(browser.storage.local, "set", (items) => {
    sets.push(items);
    return Promise.resolve();
  });
  return sets;
};

// --- validateCredentials tests ---

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

// --- MinifluxConnectionError tests ---

test("MinifluxConnectionError has correct name", () => {
  const error = new MinifluxConnectionError("Failed to connect");
  expect(error.name).toBe("MinifluxConnectionError");
});

test("MinifluxConnectionError preserves cause", () => {
  const cause = new Error("root failure");
  const error = new MinifluxConnectionError("Failed to connect", { cause });
  expect(error.cause).toBe(cause);
});

// --- request tests ---

test("request joins API path onto a base URL with subpath", async (t) => {
  const captured = [];
  t.mock.method(globalThis, "fetch", (req) => {
    captured.push(req);
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });

  await request("/v1/entries", {
    url: "https://miniflux.example.com/subpath",
    token: "token",
  });
  expect(captured[0].url).toBe(
    "https://miniflux.example.com/subpath/v1/entries",
  );

  await request("/v1/me/", {
    url: "https://miniflux.example.com/",
    token: "token",
  });
  expect(captured[1].url).toBe("https://miniflux.example.com/v1/me/");
});

test("request sends auth token and content-type only with a body", async (t) => {
  const captured = [];
  t.mock.method(globalThis, "fetch", (req) => {
    captured.push(req);
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });

  await request("/v1/me", {
    url: "https://miniflux.example.com",
    token: "token",
  });
  await request("/v1/entries", {
    url: "https://miniflux.example.com",
    token: "token",
    method: "PUT",
    body: JSON.stringify({ entry_ids: [1], status: "read" }),
  });

  expect(captured[0].headers.get("X-Auth-Token")).toBe("token");
  expect(captured[0].headers.get("Content-Type")).toBe(null);
  expect(captured[1].headers.get("Content-Type")).toBe("application/json");
});

test("request throws InvalidUrlOrTokenError when credentials are missing", async (t) => {
  mockStorage(t, {});

  let caught = null;
  try {
    await request("/v1/me");
  } catch (error) {
    caught = error;
  }
  expect(caught instanceof InvalidUrlOrTokenError).toBe(true);
});

test("request throws MinifluxConnectionError for an invalid URL", async (t) => {
  const captured = [];
  t.mock.method(globalThis, "fetch", (req) => {
    captured.push(req);
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });

  let caught = null;
  try {
    await request("/v1/me", {
      url: "reader.miniflux.app",
      token: "token",
    });
  } catch (error) {
    caught = error;
  }

  expect(caught instanceof MinifluxConnectionError).toBe(true);
  expect(caught.message).toContain("Invalid Miniflux URL");
  expect(captured.length).toBe(0);
});

// --- notifyRefresh tests ---

test("notifyRefreshEntries sends refresh action", async (t) => {
  const sent = [];
  t.mock.method(browser.runtime, "sendMessage", (message) => {
    sent.push(message);
    return Promise.resolve();
  });

  await notifyRefreshEntries();

  expect(sent.length).toBe(1);
  expect(sent[0].action).toBe(MESSAGE_REFRESH_VIEW_ENTRIES);
});

test("notifyRefreshEntries ignores no-handler rejections", async (t) => {
  t.mock.method(browser.runtime, "sendMessage", () =>
    Promise.reject(new Error("No matching handler found")),
  );

  await notifyRefreshEntries();
});

test("notifyRefreshEntries ignores connection rejections", async (t) => {
  t.mock.method(browser.runtime, "sendMessage", () =>
    Promise.reject(
      new Error(
        "Could not establish connection. Receiving end does not exist.",
      ),
    ),
  );

  await notifyRefreshEntries();
});

test("notifyRefreshEntries rethrows unexpected rejections", async (t) => {
  t.mock.method(browser.runtime, "sendMessage", () =>
    Promise.reject(new Error("boom")),
  );

  let caught = null;
  try {
    await notifyRefreshEntries();
  } catch (error) {
    caught = error;
  }
  expect(caught?.message).toBe("boom");
});

test("notifyRefreshTheme sends theme action", async (t) => {
  const sent = [];
  t.mock.method(browser.runtime, "sendMessage", (message) => {
    sent.push(message);
    return Promise.resolve();
  });

  await notifyRefreshTheme();

  expect(sent[0].action).toBe(MESSAGE_REFRESH_THEME);
});

test("notifyRefreshTheme ignores no-handler rejections", async (t) => {
  t.mock.method(browser.runtime, "sendMessage", () =>
    Promise.reject(new Error("No matching handler found")),
  );

  await notifyRefreshTheme();
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

test("groupEntriesByFeed groups entries by feed title", () => {
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
  const grouped = groupEntriesByFeed(entries);
  expect(grouped["Feed A"].length).toBe(2);
  expect(grouped["Feed A"][0]).toBe("Entry 1");
  expect(grouped["Feed A"][1]).toBe("Entry 3");
  expect(grouped["Feed B"].length).toBe(1);
  expect(grouped["Feed B"][0]).toBe("Entry 2");
});

test("groupEntriesByFeed handles missing feed title", () => {
  const entries = [
    {
      title: "Orphan Entry",
      feed: {},
    },
  ];
  const grouped = groupEntriesByFeed(entries);
  expect(Object.keys(grouped).length).toBe(1);
});

test("groupEntriesByFeed returns empty object for empty array", () => {
  const grouped = groupEntriesByFeed([]);
  expect(Object.keys(grouped).length).toBe(0);
});

test("groupEntriesByFeed handles single feed", () => {
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
  const grouped = groupEntriesByFeed(entries);
  expect(grouped["Tech"].length).toBe(3);
});

// --- refreshTheme tests ---

test("refreshTheme uses default theme when none stored", async (t) => {
  mockStorage(t, {});
  resetDOM("<!doctype html><html><head></head><body></body></html>");
  await refreshTheme();
  const theme = document.documentElement.getAttribute("data-theme");
  expect(theme).toBe("light");
});

test("refreshTheme uses stored theme when available", async (t) => {
  mockStorage(t, { theme: "dark" });
  resetDOM("<!doctype html><html><head></head><body></body></html>");
  await refreshTheme();
  const theme = document.documentElement.getAttribute("data-theme");
  expect(theme).toBe("dark");
});

// --- refreshAlarm tests ---

test("refreshAlarm creates alarm with default period", async (t) => {
  mockStorage(t, {});
  const created = [];
  t.mock.method(browser.alarms, "create", (name, options) => {
    created.push({ name, ...options });
    return Promise.resolve();
  });

  await refreshAlarm();

  expect(created.length).toBe(1);
  expect(created[0].name).toBe("ALARM_REFRESH");
  expect(created[0].periodInMinutes).toBe(15);
});

test("refreshAlarm uses stored period when available", async (t) => {
  mockStorage(t, { periodInMinutes: 30 });
  const created = [];
  t.mock.method(browser.alarms, "create", (name, options) => {
    created.push({ name, ...options });
    return Promise.resolve();
  });

  await refreshAlarm();

  expect(created[0].periodInMinutes).toBe(30);
});

test("refreshAlarm falls back to default for invalid period", async (t) => {
  mockStorage(t, { periodInMinutes: null });
  const created = [];
  t.mock.method(browser.alarms, "create", (name, options) => {
    created.push({ name, ...options });
    return Promise.resolve();
  });

  await refreshAlarm();

  expect(created[0].periodInMinutes).toBe(15);
});

// --- updateBadge tests ---

test("updateBadge sets empty badge text when no entries", async (t) => {
  mockStorage(t, { entries: [] });
  const badgeTexts = [];
  t.mock.method(browser.action, "setBadgeText", (options) => {
    badgeTexts.push(options.text);
    return Promise.resolve();
  });

  await updateBadge();

  expect(badgeTexts).toEqual([""]);
});

test("updateBadge sets badge text to entry count", async (t) => {
  mockStorage(t, {
    entries: [
      {
        id: 1,
        feed: { hide_globally: false, category: { hide_globally: false } },
      },
      {
        id: 2,
        feed: { hide_globally: false, category: { hide_globally: false } },
      },
    ],
  });
  const badgeTexts = [];
  t.mock.method(browser.action, "setBadgeText", (options) => {
    badgeTexts.push(options.text);
    return Promise.resolve();
  });

  await updateBadge();

  expect(badgeTexts).toEqual(["2"]);
});

test("updateBadge excludes hidden feed entries from count", async (t) => {
  mockStorage(t, {
    entries: [
      {
        id: 1,
        feed: { hide_globally: false, category: { hide_globally: false } },
      },
      {
        id: 2,
        feed: { hide_globally: true, category: { hide_globally: false } },
      },
    ],
  });
  const badgeTexts = [];
  t.mock.method(browser.action, "setBadgeText", (options) => {
    badgeTexts.push(options.text);
    return Promise.resolve();
  });

  await updateBadge();

  expect(badgeTexts).toEqual(["1"]);
});

// --- updateBadgeColor tests ---

test("updateBadgeColor uses default colors when none stored", async (t) => {
  mockStorage(t, {});
  const backgrounds = [];
  const texts = [];
  t.mock.method(browser.action, "setBadgeBackgroundColor", (options) => {
    backgrounds.push(options.color);
    return Promise.resolve();
  });
  t.mock.method(browser.action, "setBadgeTextColor", (options) => {
    texts.push(options.color);
    return Promise.resolve();
  });

  await updateBadgeColor();

  expect(backgrounds).toEqual(["#000000"]);
  expect(texts).toEqual(["#ffffff"]);
});

test("updateBadgeColor uses stored colors when available", async (t) => {
  mockStorage(t, {
    badgeBackgroundColor: "#ff0000",
    badgeTextColor: "#00ff00",
  });
  const backgrounds = [];
  const texts = [];
  t.mock.method(browser.action, "setBadgeBackgroundColor", (options) => {
    backgrounds.push(options.color);
    return Promise.resolve();
  });
  t.mock.method(browser.action, "setBadgeTextColor", (options) => {
    texts.push(options.color);
    return Promise.resolve();
  });

  await updateBadgeColor();

  expect(backgrounds).toEqual(["#ff0000"]);
  expect(texts).toEqual(["#00ff00"]);
});

// --- updateBadgeConnectionError tests ---

test("updateBadgeConnectionError shows lightning badge with default colors", async (t) => {
  mockStorage(t, { url: "https://miniflux.example.com" });
  const badgeTexts = [];
  const texts = [];
  const backgrounds = [];
  t.mock.method(browser.action, "setBadgeText", (options) => {
    badgeTexts.push(options.text);
    return Promise.resolve();
  });
  t.mock.method(browser.action, "setBadgeTextColor", (options) => {
    texts.push(options.color);
    return Promise.resolve();
  });
  t.mock.method(browser.action, "setBadgeBackgroundColor", (options) => {
    backgrounds.push(options.color);
    return Promise.resolve();
  });

  await updateBadgeConnectionError();

  expect(badgeTexts).toEqual(["⚡"]);
  expect(texts).toEqual(["#ffffff"]);
  expect(backgrounds).toEqual(["#000000"]);
});

test("updateBadgeConnectionError uses stored badge colors when available", async (t) => {
  mockStorage(t, {
    url: "https://miniflux.example.com",
    badgeBackgroundColor: "#123456",
  });
  const backgrounds = [];
  t.mock.method(browser.action, "setBadgeBackgroundColor", (options) => {
    backgrounds.push(options.color);
    return Promise.resolve();
  });

  await updateBadgeConnectionError();

  expect(backgrounds).toEqual(["#123456"]);
});

// --- getPopupStyle tests ---

test("getPopupStyle defaults to popup when no style param is present", () => {
  expect(getPopupStyle()).toBe("popup");
});

// --- refreshEntries tests ---

test("refreshEntries fetches unread entries and stores them", async (t) => {
  const fetched = [
    {
      id: 1,
      title: "Entry 1",
      feed: {
        title: "Feed",
        hide_globally: false,
        category: { hide_globally: false },
      },
    },
    {
      id: 2,
      title: "Entry 2",
      feed: {
        title: "Feed",
        hide_globally: false,
        category: { hide_globally: false },
      },
    },
  ];
  const sets = mockStorage(t, {
    url: "https://miniflux.example.com",
    token: "token",
    entries: [{ id: 1 }, { id: 2 }],
  });
  const captured = [];
  t.mock.method(globalThis, "fetch", (req) => {
    captured.push(req);
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ entries: fetched }),
    });
  });
  t.mock.method(console, "log", () => {});

  const result = await refreshEntries();

  expect(result).toEqual(fetched);
  expect(captured[0].url).toBe(
    "https://miniflux.example.com/v1/entries?status=unread&order=published_at&direction=desc&limit=100",
  );
  expect(sets.length).toBe(1);
  expect(sets[0].entries).toEqual(fetched);
});

test("refreshEntries uses the stored max entries limit", async (t) => {
  mockStorage(t, {
    url: "https://miniflux.example.com",
    token: "token",
    maxEntries: 250,
  });
  const captured = [];
  t.mock.method(globalThis, "fetch", (req) => {
    captured.push(req);
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ entries: [] }),
    });
  });
  t.mock.method(console, "log", () => {});

  await refreshEntries();

  expect(captured[0].url).toBe(
    "https://miniflux.example.com/v1/entries?status=unread&order=published_at&direction=desc&limit=250",
  );
});

test("refreshEntries clamps the max entries limit to the API range", async (t) => {
  mockStorage(t, {
    url: "https://miniflux.example.com",
    token: "token",
    maxEntries: 999,
  });
  const captured = [];
  t.mock.method(globalThis, "fetch", (req) => {
    captured.push(req);
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ entries: [] }),
    });
  });
  t.mock.method(console, "log", () => {});

  await refreshEntries();

  expect(captured[0].url).toContain("&limit=500");
});

test("refreshEntries falls back to the default limit for invalid values", async (t) => {
  mockStorage(t, {
    url: "https://miniflux.example.com",
    token: "token",
    maxEntries: null,
  });
  const captured = [];
  t.mock.method(globalThis, "fetch", (req) => {
    captured.push(req);
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ entries: [] }),
    });
  });
  t.mock.method(console, "log", () => {});

  await refreshEntries();

  expect(captured[0].url).toContain("&limit=100");
});

test("refreshEntries reports connection error and shows error badge", async (t) => {
  mockStorage(t, {
    url: "https://miniflux.example.com",
    token: "token",
  });
  const badgeTexts = [];
  t.mock.method(browser.action, "setBadgeText", (options) => {
    badgeTexts.push(options.text);
    return Promise.resolve();
  });
  t.mock.method(globalThis, "fetch", () =>
    Promise.resolve({
      ok: false,
      text: () => Promise.resolve("Service Unavailable"),
    }),
  );

  let caught = null;
  try {
    await refreshEntries();
  } catch (error) {
    caught = error;
  }

  expect(caught instanceof MinifluxConnectionError).toBe(true);
  expect(caught.message).toBe("Failed to fetch entries: Service Unavailable");
  expect(badgeTexts).toEqual(["⚡"]);
});

test("refreshEntries propagates invalid credentials without fetching", async (t) => {
  mockStorage(t, {});
  const captured = [];
  t.mock.method(globalThis, "fetch", (req) => {
    captured.push(req);
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ entries: [] }),
    });
  });

  let caught = null;
  try {
    await refreshEntries();
  } catch (error) {
    caught = error;
  }

  expect(caught instanceof InvalidUrlOrTokenError).toBe(true);
  expect(captured.length).toBe(0);
});

// --- refreshActionBehavior tests ---

test("refreshActionBehavior opens popup by default", async (t) => {
  mockStorage(t, {});
  const popups = [];
  t.mock.method(browser.action, "setPopup", (options) => {
    popups.push(options.popup);
    return Promise.resolve();
  });

  await refreshActionBehavior();

  expect(popups[popups.length - 1]).toBe("/pages/popup.html?style=popup");
});

test("refreshActionBehavior opens window on click when configured", async (t) => {
  mockStorage(t, { extensionClickBehavior: "window" });
  const listeners = [];
  t.mock.method(browser.action.onClicked, "addListener", (listener) => {
    listeners.push(listener);
  });

  await refreshActionBehavior();

  expect(listeners.length).toBe(1);
  expect(listeners[0].name).toBe("actionWindow");
});

test("refreshActionBehavior toggles side panel on click when configured", async (t) => {
  mockStorage(t, { extensionClickBehavior: "sidepanel" });
  const listeners = [];
  t.mock.method(browser.action.onClicked, "addListener", (listener) => {
    listeners.push(listener);
  });

  await refreshActionBehavior();

  expect(listeners.length).toBe(1);
  expect(listeners[0].name).toBe("actionSidePanel");
});
