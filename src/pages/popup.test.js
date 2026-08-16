/* global test, expect, resetDOM, document */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createSvg } from "./icons.js";
import { filterVisibleEntries, InvalidUrlOrTokenError } from "./common.js";
import {
  createEntryContent,
  setBookmarkButtonState,
  updateEmptyState,
  sortDOMEntries,
  cleanupOldDOMEntries,
} from "./popup.js";

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
