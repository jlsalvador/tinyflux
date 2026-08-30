/* global test, expect, browser, fakeClock, resetDOM, document, window, runtimeMessageListeners, setTimeout, console */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createSvg,
  svg_path_eye,
  svg_path_question_mark,
  svg_path_star_empty,
  svg_path_star_filled,
  svg_path_toggle_close,
  svg_path_toggle_open,
} from "./icons.js";
import {
  filterVisibleEntries,
  InvalidUrlOrTokenError,
  MESSAGE_MARK_ENTRY_IDS_AS_READ,
  MESSAGE_REFRESH_VIEW_ENTRIES,
  MESSAGE_TOGGLE_ENTRY_BOOKMARK,
} from "./common.js";
import {
  addDOMEntries,
  addDOMEntry,
  createEntryContent,
  setBookmarkButtonState,
  updateEmptyState,
  sortDOMEntries,
  cleanupOldDOMEntries,
} from "./popup.js";
import { testIcon } from "../test/fixtures/entries.js";
import {
  getEntries,
  getIcon,
  listIcons,
  replaceEntries,
  setIcon,
} from "./db.js";
import { __resetIDB } from "../test/fixtures/indexeddb.js";

// Entries and icons live in IndexedDB now, so clear the in-memory store before
// every test (node:test runs each file in its own process, so the db.js module
// cache and the fixture's store registry start fresh per file).
test.beforeEach(() => __resetIDB());

const __dirname = dirname(fileURLToPath(import.meta.url));
const popupHtml = readFileSync(resolve(__dirname, "popup.html"), "utf8");

const testEntries = [
  {
    id: 1,
    title: "First Entry",
    url: "https://example.com/1",
    published_at: "2024-07-11T13:05:04+02:00",
    reading_time: 5,
    starred: false,
    content: "<p>Content of first entry.</p>",
    feed: {
      id: 10,
      title: "Tech News",
      site_url: "https://tech.example.com/",
      hide_globally: false,
      icon: { feed_id: 10, icon_id: 20 },
      category: { id: 1, title: "Tech", hide_globally: false },
    },
    tags: ["tech"],
  },
  {
    id: 2,
    title: "Second Entry",
    url: "https://example.com/2",
    published_at: "2024-07-11T14:00:00+02:00",
    reading_time: 3,
    starred: true,
    content: "<p>Content of second entry.</p>",
    feed: {
      id: 10,
      title: "Tech News",
      site_url: "https://tech.example.com/",
      hide_globally: false,
      icon: { feed_id: 10, icon_id: 20 },
      category: { id: 1, title: "Tech", hide_globally: false },
    },
    tags: ["news"],
  },
  {
    id: 3,
    title: "Hidden Feed Entry",
    url: "https://example.com/3",
    published_at: "2024-07-11T15:00:00+02:00",
    reading_time: 1,
    starred: false,
    content: "<p>Should not appear.</p>",
    feed: {
      id: 20,
      title: "Hidden Feed",
      site_url: "https://hidden.example.com/",
      hide_globally: true,
      icon: null,
      category: { id: 2, title: "Hidden", hide_globally: false },
    },
    tags: [],
  },
];

// ============================================================================
// Helpers
// ============================================================================

const makeEntry = (overrides = {}) => {
  const base = {
    id: 1,
    title: "Test Entry",
    url: "https://example.com/1",
    published_at: new Date(Date.now() - 60_000).toISOString(),
    reading_time: 0,
    starred: false,
    content: "<p>Entry content.</p>",
    feed: {
      title: "Example Feed",
      site_url: "https://example.com/",
      hide_globally: false,
      category: { hide_globally: false },
    },
  };
  return {
    ...base,
    ...overrides,
    feed: { ...base.feed, ...(overrides.feed ?? {}) },
  };
};

const setupEntriesDOM = () => {
  resetDOM(
    "<!doctype html><html><head></head><body><div class='entries'></div></body></html>",
  );
  return document.querySelector(".entries");
};

const mockStorage = (t, data = {}) => {
  const store = { ...data };
  const sets = [];
  t.mock.method(browser.storage.local, "get", (keys) => {
    if (keys === null || keys === undefined) {
      return Promise.resolve({ ...store });
    }
    const keyList = Array.isArray(keys) ? keys : [keys];
    const result = {};
    for (const key of keyList) {
      if (key in store) result[key] = store[key];
    }
    return Promise.resolve(result);
  });
  t.mock.method(browser.storage.local, "getKeys", () =>
    Promise.resolve(Object.keys(store)),
  );
  t.mock.method(browser.storage.local, "set", (items) => {
    sets.push(items);
    Object.assign(store, items);
    return Promise.resolve();
  });
  return sets;
};

const mockFetch = (t, body, status = 200) => {
  const fetched = [];
  t.mock.method(globalThis, "fetch", (req) => {
    fetched.push(req);
    return Promise.resolve({
      status,
      ok: status === 200,
      json: () => Promise.resolve(body),
    });
  });
  return fetched;
};

const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

// Drives pending async chains to completion without real timers (works even
// while a fake clock is active)
const flushMicrotasks = async () => {
  for (let i = 0; i < 100; i += 1) {
    await Promise.resolve();
  }
};

// Loads the real popup.html and fires DOMContentLoaded so initializePopup
// (and localize.js) wire up their handlers exactly once
const loadPopupPage = async () => {
  resetDOM(popupHtml);
  document.dispatchEvent(new window.Event("DOMContentLoaded"));
  await flushMicrotasks();
};

// ============================================================================
// createSvg tests
// ============================================================================

test("createSvg creates an SVG element", () => {
  const svg = createSvg("M0 0h16v16H0z");
  expect(svg.tagName).toBe("svg");
  expect(svg.getAttribute("viewBox")).toBe("0 0 16 16");
  expect(svg.getAttribute("aria-hidden")).toBe("true");
});

test("createSvg applies default class", () => {
  const svg = createSvg("M0 0h16v16H0z");
  expect(svg.getAttribute("class")).toBe("icon");
});

test("createSvg applies custom class", () => {
  const svg = createSvg("M0 0h16v16H0z", "custom-icon");
  expect(svg.getAttribute("class")).toBe("custom-icon");
});

test("createSvg contains a path element", () => {
  const pathData = "M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2z";
  const svg = createSvg(pathData);
  const path = svg.querySelector("path");
  expect(path).toBeTruthy();
  expect(path.getAttribute("d")).toBe(pathData);
});

// ============================================================================
// filterVisibleEntries tests
// ============================================================================

test("filterVisibleEntries hides entries from hidden feeds", () => {
  const visible = filterVisibleEntries(testEntries);
  expect(visible.length).toBe(2);
  expect(visible[0].id).toBe(1);
  expect(visible[1].id).toBe(2);
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

test("filterVisibleEntries returns empty for empty array", () => {
  const visible = filterVisibleEntries([]);
  expect(visible.length).toBe(0);
});

// ============================================================================
// popup.html structure tests (real page markup)
// ============================================================================

test("popup.html defines every element id referenced by popup.js", () => {
  resetDOM(popupHtml);
  const requiredIds = [
    "dropdownMenu",
    "dropdownMenuButton",
    "btnMarkEntriesAsRead",
    "btnRefresh",
    "isEmpty",
    "btnOpenSidePanel",
    "btnOpenWindow",
    "btnToggleTheme",
    "btnOpenMiniflux",
    "btnSettings",
  ];
  for (const id of requiredIds) {
    expect(document.getElementById(id)).toBeTruthy();
  }
});

test("popup.html toolbar buttons contain inline SVG icons", () => {
  resetDOM(popupHtml);
  const markAll = document.getElementById("btnMarkEntriesAsRead");
  const refresh = document.getElementById("btnRefresh");
  expect(markAll.querySelector("svg.icon path")).toBeTruthy();
  expect(refresh.querySelector("svg.icon path")).toBeTruthy();
});

// ============================================================================
// InvalidUrlOrTokenError tests
// ============================================================================

test("InvalidUrlOrTokenError has correct name", () => {
  const error = new InvalidUrlOrTokenError();
  expect(error.name).toBe("InvalidUrlOrTokenError");
});

test("InvalidUrlOrTokenError has default message", () => {
  const error = new InvalidUrlOrTokenError();
  expect(error.message).toBe("You must configure your Miniflux URL and token");
});

test("InvalidUrlOrTokenError accepts custom message", () => {
  const error = new InvalidUrlOrTokenError("Custom error message");
  expect(error.message).toBe("Custom error message");
});

test("InvalidUrlOrTokenError is an instance of Error", () => {
  const error = new InvalidUrlOrTokenError();
  expect(error instanceof Error).toBe(true);
});

// ============================================================================
// createEntryContent tests
// ============================================================================

test("createEntryContent creates a div with entry-content class", () => {
  resetDOM("<!doctype html><body></body>");
  const entry = {
    id: 1,
    content: "<p>Test content</p>",
  };
  const content = createEntryContent(entry);
  expect(content.tagName).toBe("DIV");
  expect(content.classList.contains("entry-content")).toBe(true);
  expect(content.id).toBe("entryContent-1");
});

test("createEntryContent sanitizes HTML content", () => {
  resetDOM("<!doctype html><body></body>");
  const entry = {
    id: 1,
    content: "<p>Safe</p><script>alert('xss')</script>",
  };
  const content = createEntryContent(entry);
  expect(content.querySelector("script")).toBeFalsy();
  expect(content.querySelector("p")).toBeTruthy();
});

test("createEntryContent handles empty content", () => {
  resetDOM("<!doctype html><body></body>");
  const entry = {
    id: 1,
    content: "",
  };
  const content = createEntryContent(entry);
  expect(content.children.length).toBe(0);
});

test("createEntryContent preserves allowed tags", () => {
  resetDOM("<!doctype html><body></body>");
  const entry = {
    id: 1,
    content: "<p>Paragraph</p><strong>Bold</strong>",
  };
  const content = createEntryContent(entry);
  expect(content.querySelector("p")).toBeTruthy();
  expect(content.querySelector("strong")).toBeTruthy();
});

// ============================================================================
// setBookmarkButtonState tests
// ============================================================================

test("setBookmarkButtonState adds starred class when starred", () => {
  resetDOM(
    "<!doctype html><body><button class='entry-action-btn'></button></body>",
  );
  const btn = document.querySelector("button");
  setBookmarkButtonState(btn, true);
  expect(btn.classList.contains("starred")).toBe(true);
});

test("setBookmarkButtonState removes starred class when not starred", () => {
  resetDOM(
    "<!doctype html><body><button class='entry-action-btn starred'></button></body>",
  );
  const btn = document.querySelector("button");
  setBookmarkButtonState(btn, false);
  expect(btn.classList.contains("starred")).toBe(false);
});

test("setBookmarkButtonState sets filled star icon when starred", () => {
  resetDOM(
    "<!doctype html><body><button class='entry-action-btn'></button></body>",
  );
  const btn = document.querySelector("button");
  setBookmarkButtonState(btn, true);
  const svg = btn.querySelector("svg");
  expect(svg).toBeTruthy();
});

test("setBookmarkButtonState sets empty star icon when not starred", () => {
  resetDOM(
    "<!doctype html><body><button class='entry-action-btn'></button></body>",
  );
  const btn = document.querySelector("button");
  setBookmarkButtonState(btn, false);
  const svg = btn.querySelector("svg");
  expect(svg).toBeTruthy();
});

// ============================================================================
// updateEmptyState tests
// ============================================================================

test("updateEmptyState hides empty state when entries exist", () => {
  resetDOM(
    "<!doctype html><body><div class='entries'><div id='isEmpty' class='empty-state'></div><div class='entry' data-entry-id='1'></div></div></body>",
  );
  updateEmptyState();
  const isEmpty = document.getElementById("isEmpty");
  expect(isEmpty.classList.contains("hidden")).toBe(true);
});

test("updateEmptyState shows empty state when no entries exist", () => {
  resetDOM(
    "<!doctype html><body><div class='entries'><div id='isEmpty' class='empty-state hidden'></div></div></body>",
  );
  updateEmptyState();
  const isEmpty = document.getElementById("isEmpty");
  expect(isEmpty.classList.contains("hidden")).toBe(false);
});

test("updateEmptyState does nothing when isEmpty element is missing", () => {
  resetDOM(
    "<!doctype html><body><div class='entries'><div class='entry'></div></div></body>",
  );
  let threw = false;
  try {
    updateEmptyState();
  } catch {
    threw = true;
  }
  expect(threw).toBe(false);
});

// ============================================================================
// sortDOMEntries tests
// ============================================================================

test("sortDOMEntries sorts entries by timestamp descending", () => {
  resetDOM(
    "<!doctype html><body>" +
      "<div class='entries'>" +
      "<div class='entry' data-entry-id='1' data-timestamp='1000'></div>" +
      "<div class='entry' data-entry-id='2' data-timestamp='3000'></div>" +
      "<div class='entry' data-entry-id='3' data-timestamp='2000'></div>" +
      "</div></body>",
  );
  sortDOMEntries();
  const container = document.querySelector(".entries");
  const entries = container.querySelectorAll(".entry");
  expect(entries[0].dataset.entryId).toBe("2");
  expect(entries[1].dataset.entryId).toBe("3");
  expect(entries[2].dataset.entryId).toBe("1");
});

test("sortDOMEntries handles empty container", () => {
  resetDOM("<!doctype html><body><div class='entries'></div></body>");
  let threw = false;
  try {
    sortDOMEntries();
  } catch {
    threw = true;
  }
  expect(threw).toBe(false);
});

test("sortDOMEntries does nothing when no container exists", () => {
  resetDOM("<!doctype html><body></body>");
  let threw = false;
  try {
    sortDOMEntries();
  } catch {
    threw = true;
  }
  expect(threw).toBe(false);
});

test("sortDOMEntries handles single entry", () => {
  resetDOM(
    "<!doctype html><body>" +
      "<div class='entries'>" +
      "<div class='entry' data-entry-id='1' data-timestamp='1000'></div>" +
      "</div></body>",
  );
  sortDOMEntries();
  const container = document.querySelector(".entries");
  const entries = container.querySelectorAll(".entry");
  expect(entries.length).toBe(1);
  expect(entries[0].dataset.entryId).toBe("1");
});

test("sortDOMEntries handles equal timestamps", () => {
  resetDOM(
    "<!doctype html><body>" +
      "<div class='entries'>" +
      "<div class='entry' data-entry-id='1' data-timestamp='1000'></div>" +
      "<div class='entry' data-entry-id='2' data-timestamp='1000'></div>" +
      "</div></body>",
  );
  sortDOMEntries();
  const container = document.querySelector(".entries");
  expect(container.children.length).toBe(2);
});

// ============================================================================
// cleanupOldDOMEntries tests
// ============================================================================

test("cleanupOldDOMEntries removes entries not in new set", () => {
  resetDOM(
    "<!doctype html><body>" +
      "<div class='entries'>" +
      "<div class='entry' data-entry-id='1'></div>" +
      "<div class='entry' data-entry-id='2'></div>" +
      "<div class='entry' data-entry-id='3'></div>" +
      "</div></body>",
  );
  const newEntries = [{ id: 1 }, { id: 3 }];
  cleanupOldDOMEntries(newEntries);
  const remaining = document.querySelectorAll(".entry");
  expect(remaining.length).toBe(2);
  expect(remaining[0].dataset.entryId).toBe("1");
  expect(remaining[1].dataset.entryId).toBe("3");
});

test("cleanupOldDOMEntries keeps all entries when all present in new set", () => {
  resetDOM(
    "<!doctype html><body>" +
      "<div class='entries'>" +
      "<div class='entry' data-entry-id='1'></div>" +
      "<div class='entry' data-entry-id='2'></div>" +
      "</div></body>",
  );
  const newEntries = [{ id: 1 }, { id: 2 }];
  cleanupOldDOMEntries(newEntries);
  const remaining = document.querySelectorAll(".entry");
  expect(remaining.length).toBe(2);
});

test("cleanupOldDOMEntries removes all entries when new set is empty", () => {
  resetDOM(
    "<!doctype html><body>" +
      "<div class='entries'>" +
      "<div class='entry' data-entry-id='1'></div>" +
      "<div class='entry' data-entry-id='2'></div>" +
      "</div></body>",
  );
  cleanupOldDOMEntries([]);
  const remaining = document.querySelectorAll(".entry");
  expect(remaining.length).toBe(0);
});

test("cleanupOldDOMEntries does nothing when no container exists", () => {
  resetDOM("<!doctype html><body></body>");
  let threw = false;
  try {
    cleanupOldDOMEntries([{ id: 1 }]);
  } catch {
    threw = true;
  }
  expect(threw).toBe(false);
});

test("cleanupOldDOMEntries handles entries with invalid entryId", () => {
  resetDOM(
    "<!doctype html><body>" +
      "<div class='entries'>" +
      "<div class='entry' data-entry-id='abc'></div>" +
      "<div class='entry' data-entry-id='1'></div>" +
      "</div></body>",
  );
  cleanupOldDOMEntries([{ id: 1 }]);
  const remaining = document.querySelectorAll(".entry");
  expect(remaining.length).toBe(1);
  expect(remaining[0].dataset.entryId).toBe("1");
});

// ============================================================================
// addDOMEntry / createEntry / createEntryTitle tests
// ============================================================================

test("addDOMEntry renders entry title, feed info, stats and actions", async (t) => {
  const container = setupEntriesDOM();
  mockStorage(t);

  const entry = makeEntry();
  await addDOMEntry(entry);

  const entryEl = document.getElementById("entry-1");
  expect(entryEl).toBeTruthy();
  expect(entryEl.classList.contains("entry")).toBe(true);
  expect(entryEl.dataset.entryId).toBe("1");
  expect(entryEl.dataset.timestamp).toBe(
    String(new Date(entry.published_at).getTime()),
  );
  expect(container.querySelector(".entry")).toBe(entryEl);

  const title = entryEl.querySelector(".entry-title");
  expect(title.id).toBe("entryTitle-1");
  expect(title.querySelector(".entry-title-text").textContent).toBe(
    "Test Entry",
  );

  expect(entryEl.querySelector(".feed-title").textContent).toBe("Example Feed");
  expect(entryEl.querySelector(".feed-icon")).toBeFalsy();

  const stats = entryEl.querySelectorAll(".entry-stat");
  expect(stats.length).toBe(1);
  expect(stats[0].textContent).toBe("1m");

  const buttons = entryEl.querySelectorAll(".entry-action-btn");
  expect(buttons.length).toBe(3);
  expect(buttons[0].querySelector("path").getAttribute("d")).toBe(
    svg_path_star_empty,
  );
  expect(buttons[1].querySelector("path").getAttribute("d")).toBe(svg_path_eye);
  expect(buttons[2].querySelector("path").getAttribute("d")).toBe(
    svg_path_toggle_open,
  );
  expect(document.getElementById("entryContent-1")).toBeFalsy();
});

test("addDOMEntry renders starred state and reading time stat", async (t) => {
  setupEntriesDOM();
  mockStorage(t);

  await addDOMEntry(makeEntry({ id: 2, starred: true, reading_time: 3 }));

  const entryEl = document.getElementById("entry-2");
  const bookmarkBtn = entryEl.querySelector(".entry-action-btn");
  expect(bookmarkBtn.classList.contains("starred")).toBe(true);
  expect(bookmarkBtn.querySelector("path").getAttribute("d")).toBe(
    svg_path_star_filled,
  );

  const stats = entryEl.querySelectorAll(".entry-stat");
  expect(stats.length).toBe(2);
  expect(stats[1].textContent).toBe("pagePopupReadingTimeShort");
});

test("addDOMEntry skips rendering when entry already exists", async (t) => {
  const container = setupEntriesDOM();
  mockStorage(t);

  await addDOMEntry(makeEntry());
  await addDOMEntry(makeEntry());

  expect(container.querySelectorAll(".entry").length).toBe(1);
});

test("addDOMEntry renders the entry once when two refreshes overlap", async (t) => {
  const container = setupEntriesDOM();
  mockStorage(t);

  // Both calls pass the initial existence check before either one finishes
  // creating the entry (createEntry awaits the icon), so the element must
  // still be rendered exactly once.
  const entry = makeEntry();
  await Promise.all([addDOMEntry(entry), addDOMEntry(entry)]);

  expect(container.querySelectorAll(".entry").length).toBe(1);
});

test("addDOMEntry does nothing when entries container is missing", async (t) => {
  resetDOM("<!doctype html><html><head></head><body></body></html>");
  mockStorage(t);

  await addDOMEntry(makeEntry());

  expect(document.getElementById("entry-1")).toBeFalsy();
});

// ============================================================================
// Feed icon (getIcon) tests
// ============================================================================

test("addDOMEntry renders feed icon from storage cache", async (t) => {
  setupEntriesDOM();
  mockStorage(t);
  await setIcon(20, { icon: testIcon, fetchedAt: Date.now() });
  const fetched = mockFetch(t, testIcon);

  await addDOMEntry(
    makeEntry({ feed: { icon: { feed_id: 28, icon_id: 20 } } }),
  );

  const icon = document.querySelector(".feed-icon");
  expect(icon).toBeTruthy();
  expect(icon.getAttribute("src")).toBe(`data:${testIcon.data}`);
  expect(icon.alt).toBe("Example Feed");
  expect(fetched.length).toBe(0);
});

test("addDOMEntry fetches feed icon from API and caches it", async (t) => {
  setupEntriesDOM();
  mockStorage(t, {
    url: "https://miniflux.example.com",
    token: "test-token",
  });
  const fetched = mockFetch(t, testIcon);

  await addDOMEntry(
    makeEntry({ feed: { icon: { feed_id: 28, icon_id: 30 } } }),
  );

  const icon = document.querySelector(".feed-icon");
  expect(icon.getAttribute("src")).toBe(`data:${testIcon.data}`);
  expect(fetched.length).toBe(1);
  expect(fetched[0].url).toBe("https://miniflux.example.com/v1/icons/30");
  // The icon is stored in IndexedDB with a fetch timestamp.
  const stored = await getIcon(30);
  expect(stored.icon).toEqual(testIcon);
  expect(typeof stored.fetchedAt).toBe("number");
});

test("addDOMEntry refetches feed icon when the cached icon is stale", async (t) => {
  setupEntriesDOM();
  mockStorage(t, {
    url: "https://miniflux.example.com",
    token: "test-token",
  });
  // A cached icon older than the TTL must be refetched and overwritten.
  await setIcon(60, {
    icon: testIcon,
    fetchedAt: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days old
  });
  const fetched = mockFetch(t, testIcon);

  await addDOMEntry(
    makeEntry({ feed: { icon: { feed_id: 28, icon_id: 60 } } }),
  );

  expect(fetched.length).toBe(1);
  const stored = await getIcon(60);
  expect(stored.icon).toEqual(testIcon);
});

test("icon cache is pruned down to the max entries limit", async (t) => {
  setupEntriesDOM();
  mockStorage(t, {
    url: "https://miniflux.example.com",
    token: "test-token",
    maxEntries: 3,
  });
  await setIcon(1, { icon: testIcon, fetchedAt: 1000 });
  await setIcon(2, { icon: testIcon, fetchedAt: 2000 });
  await setIcon(3, { icon: testIcon, fetchedAt: 3000 });
  await setIcon(4, { icon: testIcon, fetchedAt: 4000 });
  const fetched = mockFetch(t, testIcon);

  // icon5 is not cached: it is fetched and stored, then the cache (5 icons)
  // is pruned back to the maxEntries limit of 3, dropping the 2 oldest.
  await addDOMEntry(makeEntry({ feed: { icon: { feed_id: 28, icon_id: 5 } } }));

  expect(fetched.length).toBe(1);
  const ids = (await listIcons()).map((i) => i.id).sort((a, b) => a - b);
  expect(ids).toEqual([3, 4, 5]);
});

test("addDOMEntry omits feed icon when API request fails", async (t) => {
  setupEntriesDOM();
  mockStorage(t, {
    url: "https://miniflux.example.com",
    token: "test-token",
  });
  mockFetch(t, {}, 404);
  const errors = [];
  t.mock.method(console, "error", (...args) => {
    errors.push(args);
  });

  await addDOMEntry(
    makeEntry({ feed: { icon: { feed_id: 28, icon_id: 40 } } }),
  );

  expect(document.querySelector(".feed-icon")).toBeFalsy();
  expect(errors.length).toBe(1);
  expect(String(errors[0][0])).toContain("Failed to fetch icon");
  expect(document.querySelector(".feed-title").textContent).toBe(
    "Example Feed",
  );
});

test("addDOMEntry serves repeated icon lookups from memory cache", async (t) => {
  setupEntriesDOM();
  mockStorage(t, {
    url: "https://miniflux.example.com",
    token: "test-token",
  });
  const fetched = mockFetch(t, testIcon);

  await addDOMEntry(makeEntry({ id: 1, feed: { icon: { icon_id: 50 } } }));
  await addDOMEntry(makeEntry({ id: 2, feed: { icon: { icon_id: 50 } } }));

  expect(fetched.length).toBe(1);
  expect((await listIcons()).length).toBe(1);
  expect(document.querySelectorAll(".feed-icon").length).toBe(2);
});

// ============================================================================
// Entry action button tests
// ============================================================================

test("toggle button expands and collapses entry content", async (t) => {
  setupEntriesDOM();
  mockStorage(t);

  await addDOMEntry(makeEntry());

  const entryEl = document.getElementById("entry-1");
  const titleEl = entryEl.querySelector(".entry-title");
  const toggleBtn = entryEl.querySelectorAll(".entry-action-btn")[2];

  toggleBtn.click();
  expect(titleEl.classList.contains("expanded")).toBe(true);
  const content = document.getElementById("entryContent-1");
  expect(content).toBeTruthy();
  expect(content.textContent).toContain("Entry content.");
  expect(toggleBtn.querySelector("path").getAttribute("d")).toBe(
    svg_path_toggle_close,
  );

  toggleBtn.click();
  expect(titleEl.classList.contains("expanded")).toBe(false);
  expect(document.getElementById("entryContent-1")).toBeFalsy();
  expect(toggleBtn.querySelector("path").getAttribute("d")).toBe(
    svg_path_toggle_open,
  );
});

test("bookmark click toggles star and sends toggle message", async (t) => {
  setupEntriesDOM();
  mockStorage(t);
  const sent = [];
  t.mock.method(browser.runtime, "sendMessage", (message) => {
    sent.push(message);
    return Promise.resolve(true);
  });

  await addDOMEntry(makeEntry());

  const bookmarkBtn = document
    .getElementById("entry-1")
    .querySelector(".entry-action-btn");
  bookmarkBtn.click();
  await flushAsync();

  expect(bookmarkBtn.classList.contains("starred")).toBe(true);
  expect(bookmarkBtn.querySelector("path").getAttribute("d")).toBe(
    svg_path_star_filled,
  );
  expect(sent.length).toBe(1);
  expect(sent[0]).toEqual({
    action: MESSAGE_TOGGLE_ENTRY_BOOKMARK,
    entryId: 1,
  });
});

test("bookmark click reverts star when message fails", async (t) => {
  setupEntriesDOM();
  mockStorage(t);
  t.mock.method(browser.runtime, "sendMessage", () =>
    Promise.reject(new Error("bookmark failed")),
  );
  const errors = [];
  t.mock.method(console, "error", (...args) => {
    errors.push(args);
  });

  await addDOMEntry(makeEntry({ starred: true }));

  const bookmarkBtn = document
    .getElementById("entry-1")
    .querySelector(".entry-action-btn");
  expect(bookmarkBtn.classList.contains("starred")).toBe(true);

  bookmarkBtn.click();
  await flushAsync();

  expect(bookmarkBtn.classList.contains("starred")).toBe(true);
  expect(bookmarkBtn.querySelector("path").getAttribute("d")).toBe(
    svg_path_star_filled,
  );
  expect(errors.length).toBe(1);
  expect(String(errors[0][0])).toContain("Failed to toggle bookmark");
});

test("mark as read click sends message and re-enables button", async (t) => {
  setupEntriesDOM();
  mockStorage(t);
  const sent = [];
  t.mock.method(browser.runtime, "sendMessage", (message) => {
    sent.push(message);
    return Promise.resolve(true);
  });

  await addDOMEntry(makeEntry());

  const markReadBtn = document
    .getElementById("entry-1")
    .querySelectorAll(".entry-action-btn")[1];
  markReadBtn.click();
  await flushAsync();

  expect(sent.length).toBe(1);
  expect(sent[0]).toEqual({
    action: MESSAGE_MARK_ENTRY_IDS_AS_READ,
    entryIds: [1],
  });
  expect(markReadBtn.disabled).toBe(false);
  expect(markReadBtn.querySelector(".icon").classList.contains("loading")).toBe(
    false,
  );
});

// ============================================================================
// Entry click (openLink) tests
// ============================================================================

test("title click opens entry url in a new tab", async (t) => {
  setupEntriesDOM();
  mockStorage(t);
  const tabs = [];
  t.mock.method(browser.tabs, "create", (options) => {
    tabs.push(options);
    return Promise.resolve({ id: 1 });
  });

  await addDOMEntry(makeEntry());

  document.querySelector(".entry-title-text").click();
  await flushAsync();

  expect(tabs.length).toBe(1);
  expect(tabs[0]).toEqual({ active: true, url: "https://example.com/1" });
});

test("title click marks entry as read when option is enabled", async (t) => {
  setupEntriesDOM();
  mockStorage(t, { markEntryAsReadWhenOpenedAsTab: true });
  const sent = [];
  t.mock.method(browser.runtime, "sendMessage", (message) => {
    sent.push(message);
    return Promise.resolve(true);
  });
  t.mock.method(browser.tabs, "create", () => Promise.resolve({ id: 1 }));

  await addDOMEntry(makeEntry());

  document.querySelector(".entry-title-text").click();
  await flushAsync();

  expect(sent.length).toBe(1);
  expect(sent[0]).toEqual({
    action: MESSAGE_MARK_ENTRY_IDS_AS_READ,
    entryIds: [1],
  });
});

test("title click does not mark entry as read by default", async (t) => {
  setupEntriesDOM();
  mockStorage(t);
  const sent = [];
  t.mock.method(browser.runtime, "sendMessage", (message) => {
    sent.push(message);
    return Promise.resolve(true);
  });
  t.mock.method(browser.tabs, "create", () => Promise.resolve({ id: 1 }));

  await addDOMEntry(makeEntry());

  document.querySelector(".entry-title-text").click();
  await flushAsync();

  expect(sent.length).toBe(0);
});

test("feed info click opens feed site url", async (t) => {
  setupEntriesDOM();
  mockStorage(t);
  const tabs = [];
  t.mock.method(browser.tabs, "create", (options) => {
    tabs.push(options);
    return Promise.resolve({ id: 1 });
  });

  await addDOMEntry(makeEntry());

  document.querySelector(".entry-feed-info").click();
  await flushAsync();

  expect(tabs.length).toBe(1);
  expect(tabs[0]).toEqual({ active: true, url: "https://example.com/" });
});

// ============================================================================
// addDOMEntries tests
// ============================================================================

test("addDOMEntries renders visible entries sorted newest first", async (t) => {
  const container = setupEntriesDOM();
  mockStorage(t);

  const older = makeEntry({
    id: 1,
    published_at: new Date(Date.now() - 120_000).toISOString(),
  });
  const newer = makeEntry({ id: 2, url: "https://example.com/2" });
  const hidden = makeEntry({ id: 3, feed: { hide_globally: true } });

  await addDOMEntries([hidden, older, newer]);

  const rendered = Array.from(container.querySelectorAll(".entry"));
  expect(rendered.length).toBe(2);
  expect(rendered[0].dataset.entryId).toBe("2");
  expect(rendered[1].dataset.entryId).toBe("1");
});

test("addDOMEntries does nothing for empty list", async (t) => {
  const container = setupEntriesDOM();
  mockStorage(t);

  await addDOMEntries([]);

  expect(container.querySelectorAll(".entry").length).toBe(0);
});

// ============================================================================
// Message listener tests
// ============================================================================

test("refresh_view_entries message re-renders entries from storage", async (t) => {
  const container = setupEntriesDOM();
  const nextEntry = makeEntry({
    id: 2,
    url: "https://example.com/2",
    published_at: new Date(Date.now() - 30_000).toISOString(),
  });
  mockStorage(t);
  await replaceEntries([nextEntry]);

  await addDOMEntry(makeEntry({ id: 1 }));
  expect(container.querySelectorAll(".entry").length).toBe(1);

  const handler = runtimeMessageListeners.at(-1);
  await handler({ action: MESSAGE_REFRESH_VIEW_ENTRIES });

  expect(document.getElementById("entry-1")).toBeFalsy();
  expect(document.getElementById("entry-2")).toBeTruthy();
});

test("message listener ignores unknown actions", () => {
  const handler = runtimeMessageListeners.at(-1);
  expect(handler({ action: "unknown-action" })).toBe(false);
});

test("entries from hidden feeds are removed from the DOM on refresh", async (t) => {
  const container = setupEntriesDOM();
  mockStorage(t);
  await replaceEntries([makeEntry({ id: 1, feed: { hide_globally: true } })]);

  await addDOMEntry(makeEntry({ id: 1 }));
  expect(container.querySelectorAll(".entry").length).toBe(1);

  const handler = runtimeMessageListeners.at(-1);
  await handler({ action: MESSAGE_REFRESH_VIEW_ENTRIES });

  expect(document.getElementById("entry-1")).toBeFalsy();
  expect(container.querySelectorAll(".entry").length).toBe(0);
});

// ============================================================================
// Mark all as read button tests
// ============================================================================

test("mark all as read first click shows confirmation state", async (t) => {
  fakeClock(t);
  mockStorage(t);
  const sent = [];
  t.mock.method(browser.runtime, "sendMessage", (message) => {
    sent.push(message);
    return Promise.resolve(true);
  });
  await loadPopupPage();

  const button = document.getElementById("btnMarkEntriesAsRead");
  const path = button.querySelector(".icon path");

  button.click();
  await flushMicrotasks();

  expect(button.classList.contains("danger")).toBe(true);
  expect(path.getAttribute("d")).toBe(svg_path_question_mark);
  expect(button.title).toBe("pagePopupAreYouSureToMarkAllEntriesAsRead");
  expect(button.disabled).toBe(false);
  expect(sent.length).toBe(0);
});

test("mark all as read second click marks all visible entries as read", async (t) => {
  fakeClock(t);
  const older = makeEntry({
    id: 1,
    published_at: new Date(Date.now() - 120_000).toISOString(),
  });
  const newer = makeEntry({
    id: 2,
    url: "https://example.com/2",
    published_at: new Date(Date.now() - 60_000).toISOString(),
  });
  mockStorage(t);
  await replaceEntries([older, newer]);
  const sent = [];
  t.mock.method(browser.runtime, "sendMessage", (message) => {
    sent.push(message);
    return Promise.resolve(true);
  });
  await loadPopupPage();

  expect(document.querySelectorAll(".entry").length).toBe(2);

  const button = document.getElementById("btnMarkEntriesAsRead");
  const path = button.querySelector(".icon path");
  const previousIconPath = path.getAttribute("d");

  button.click();
  await flushMicrotasks();
  button.click();
  await flushMicrotasks();

  expect(sent.length).toBe(1);
  expect(sent[0]).toEqual({
    action: MESSAGE_MARK_ENTRY_IDS_AS_READ,
    entryIds: [2, 1],
  });
  expect(button.disabled).toBe(false);
  expect(button.classList.contains("danger")).toBe(false);
  expect(button.querySelector(".icon").classList.contains("loading")).toBe(
    false,
  );
  expect(path.getAttribute("d")).toBe(previousIconPath);
});

test("mark all as read confirmation resets after the timeout", async (t) => {
  const clock = fakeClock(t);
  mockStorage(t);
  await loadPopupPage();

  const button = document.getElementById("btnMarkEntriesAsRead");
  const path = button.querySelector(".icon path");
  const previousIconPath = path.getAttribute("d");

  button.click();
  expect(button.classList.contains("danger")).toBe(true);
  expect(path.getAttribute("d")).toBe(svg_path_question_mark);

  clock.tick(5000);

  expect(button.classList.contains("danger")).toBe(false);
  expect(path.getAttribute("d")).toBe(previousIconPath);
  expect(button.title).toBe("pagePopupMarkEntriesAsRead");
});

test("mark all as read second click without entries sends no message", async (t) => {
  fakeClock(t);
  mockStorage(t);
  const sent = [];
  t.mock.method(browser.runtime, "sendMessage", (message) => {
    sent.push(message);
    return Promise.resolve(true);
  });
  await loadPopupPage();

  const button = document.getElementById("btnMarkEntriesAsRead");
  button.click();
  await flushMicrotasks();
  button.click();
  await flushMicrotasks();

  expect(sent.length).toBe(0);
  expect(button.disabled).toBe(false);
  expect(button.classList.contains("danger")).toBe(false);
});

// ============================================================================
// Refresh button tests
// ============================================================================

test("refresh button refetches entries and re-renders the view", async (t) => {
  const older = makeEntry({
    id: 1,
    published_at: new Date(Date.now() - 120_000).toISOString(),
  });
  const fetchedEntry = makeEntry({
    id: 7,
    url: "https://example.com/7",
    published_at: new Date(Date.now() - 30_000).toISOString(),
  });
  mockStorage(t, {
    url: "https://miniflux.example.com",
    token: "test-token",
  });
  await replaceEntries([older]);
  const fetched = mockFetch(t, { entries: [fetchedEntry] });
  await loadPopupPage();

  expect(document.getElementById("entry-1")).toBeTruthy();

  const button = document.getElementById("btnRefresh");
  button.click();
  await flushMicrotasks();

  // The manual refresh forces a full sync, plus the badge's unread count
  // request.
  expect(fetched.length).toBe(2);
  expect(fetched[0].url).toBe(
    "https://miniflux.example.com/v1/entries?status=unread&order=published_at&direction=desc&limit=100",
  );
  expect(fetched[1].url).toBe(
    "https://miniflux.example.com/v1/entries?status=unread&globally_visible=true&limit=1",
  );
  expect((await getEntries()).map((e) => e.id)).toEqual([7]);
  expect(document.getElementById("entry-1")).toBeFalsy();
  expect(document.getElementById("entry-7")).toBeTruthy();
  expect(button.disabled).toBe(false);
  expect(button.querySelector(".icon").classList.contains("loading")).toBe(
    false,
  );
});

test("refresh button opens settings when credentials are invalid", async (t) => {
  mockStorage(t);
  const opened = [];
  t.mock.method(browser.runtime, "openOptionsPage", () => {
    opened.push(true);
    return Promise.resolve();
  });
  await loadPopupPage();

  const button = document.getElementById("btnRefresh");
  button.click();
  await flushMicrotasks();

  expect(opened.length).toBe(1);
  expect(button.disabled).toBe(false);
  expect(button.querySelector(".icon").classList.contains("loading")).toBe(
    false,
  );
});
