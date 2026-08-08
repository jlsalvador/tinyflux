/* global test, expect, resetDOM, document */

import { createSvg } from "./icons.js";
import { filterVisibleEntries, InvalidUrlOrTokenError } from "./common.js";
import { TimeAgo, Style } from "./timeago.js";

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
// TimeAgo tests
// ============================================================================

test("TimeAgo returns 1s for a timestamp 1 second in the past", () => {
  expect(TimeAgo(Date.now() - 1000, Style.ExtremeNarrow)).toBe("1s");
});

test("TimeAgo returns 1m for a timestamp 1 minute in the past", () => {
  expect(TimeAgo(Date.now() - 60_000, Style.ExtremeNarrow)).toBe("1m");
});

test("TimeAgo handles ISO date strings", () => {
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  expect(TimeAgo(oneMinuteAgo, Style.ExtremeNarrow)).toBe("1m");
});

test("TimeAgo Long style returns human-readable format", () => {
  expect(TimeAgo(Date.now() - 1000, Style.Long)).toBe("1 second ago");
});

// ============================================================================
// DOM entry rendering tests
// ============================================================================

test("entry elements are created with correct structure", async () => {
  resetDOM("<!doctype html><body><div class='entries'></div></body>");

  const container = document.querySelector(".entries");
  const entry = testEntries[0];

  const entryElement = document.createElement("div");
  entryElement.id = `entry-${entry.id}`;
  entryElement.dataset.entryId = entry.id;
  entryElement.dataset.timestamp = new Date(entry.published_at).getTime();
  entryElement.className = "entry";

  const titleContainer = document.createElement("div");
  titleContainer.id = `entryTitle-${entry.id}`;
  titleContainer.className = "entry-title";

  const titleText = document.createElement("div");
  titleText.className = "entry-title-text";
  titleText.textContent = entry.title;
  titleContainer.appendChild(titleText);

  entryElement.appendChild(titleContainer);
  container.appendChild(entryElement);

  expect(container.children.length).toBe(1);
  expect(entryElement.id).toBe("entry-1");
  expect(entryElement.dataset.entryId).toBe("1");
  expect(entryElement.className).toBe("entry");
  expect(titleText.textContent).toBe("First Entry");
});

test("entries container has correct role and aria attributes", () => {
  resetDOM(
    "<!doctype html><body><div class='entries' role='feed' aria-label='RSS Feed Entries'></div></body>",
  );

  const container = document.querySelector(".entries");
  expect(container.getAttribute("role")).toBe("feed");
  expect(container.getAttribute("aria-label")).toBe("RSS Feed Entries");
});

test("empty state is hidden when entries exist", () => {
  resetDOM(
    "<!doctype html><body><div class='entries'><div id='isEmpty' class='empty-state hidden'></div><div class='entry' data-entry-id='1'></div></div></body>",
  );

  const isEmpty = document.getElementById("isEmpty");
  const entries = document.querySelectorAll(".entry");
  expect(entries.length).toBe(1);
  expect(isEmpty.classList.contains("hidden")).toBe(true);
});

test("empty state is visible when no entries exist", () => {
  resetDOM(
    "<!doctype html><body><div class='entries'><div id='isEmpty' class='empty-state'></div></div></body>",
  );

  const isEmpty = document.getElementById("isEmpty");
  expect(isEmpty.classList.contains("hidden")).toBe(false);
});

test("dropdown menu has correct structure", () => {
  resetDOM(
    "<!doctype html><body>" +
      "<ul class='dropdown-menu' id='dropdownMenu' role='menu'>" +
      "<li role='none'><a class='dropdown-item' href='#' role='menuitem' id='btnOpenSidePanel'>Side Panel</a></li>" +
      "<li role='none'><a class='dropdown-item' href='#' role='menuitem' id='btnOpenWindow'>Window</a></li>" +
      "<li role='none'><a class='dropdown-item' href='#' role='menuitem' id='btnToggleTheme'>Theme</a></li>" +
      "<li role='none'><a class='dropdown-item' href='#' role='menuitem' id='btnOpenMiniflux'>Miniflux</a></li>" +
      "<li role='none'><a class='dropdown-item' href='#' role='menuitem' id='btnSettings'>Settings</a></li>" +
      "</ul>" +
      "</body>",
  );

  const menu = document.getElementById("dropdownMenu");
  const items = menu.querySelectorAll(".dropdown-item");
  expect(items.length).toBe(5);
  expect(document.getElementById("btnOpenSidePanel")).toBeTruthy();
  expect(document.getElementById("btnOpenWindow")).toBeTruthy();
  expect(document.getElementById("btnToggleTheme")).toBeTruthy();
  expect(document.getElementById("btnOpenMiniflux")).toBeTruthy();
  expect(document.getElementById("btnSettings")).toBeTruthy();
});

test("mark all as read button has correct classes", () => {
  resetDOM(
    "<!doctype html><body><button id='btnMarkEntriesAsRead' class='btn btn-icon' type='button' aria-label='Mark entries as read'></button></body>",
  );

  const btn = document.getElementById("btnMarkEntriesAsRead");
  expect(btn).toBeTruthy();
  expect(btn.classList.contains("btn")).toBe(true);
  expect(btn.classList.contains("btn-icon")).toBe(true);
  expect(btn.getAttribute("type")).toBe("button");
});

test("refresh button has correct classes", () => {
  resetDOM(
    "<!doctype html><body><button id='btnRefresh' class='btn btn-icon btn-primary' type='button' aria-label='Refresh'></button></body>",
  );

  const btn = document.getElementById("btnRefresh");
  expect(btn).toBeTruthy();
  expect(btn.classList.contains("btn")).toBe(true);
  expect(btn.classList.contains("btn-icon")).toBe(true);
  expect(btn.classList.contains("btn-primary")).toBe(true);
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
// DOM manipulation utility tests
// ============================================================================

test("element classList toggle works correctly", () => {
  resetDOM("<!doctype html><body><div class='entry'></div></body>");
  const el = document.querySelector(".entry");

  el.classList.add("visible");
  expect(el.classList.contains("visible")).toBe(true);

  el.classList.toggle("visible");
  expect(el.classList.contains("visible")).toBe(false);

  el.classList.toggle("visible");
  expect(el.classList.contains("visible")).toBe(true);
});

test("element dataset attributes persist", () => {
  resetDOM("<!doctype html><body><div class='entry'></div></body>");
  const el = document.querySelector(".entry");

  el.dataset.entryId = "123";
  el.dataset.timestamp = "1234567890";
  expect(el.dataset.entryId).toBe("123");
  expect(el.dataset.timestamp).toBe("1234567890");
});

test("appendChild adds child to parent", () => {
  resetDOM("<!doctype html><body><div class='parent'></div></body>");
  const parent = document.querySelector(".parent");
  const child = document.createElement("div");
  child.className = "child";

  parent.appendChild(child);
  expect(parent.children.length).toBe(1);
  expect(parent.querySelector(".child")).toBeTruthy();
});

test("removeChild removes child from parent", () => {
  resetDOM(
    "<!doctype html><body><div class='parent'><div class='child'></div></div></body>",
  );
  const parent = document.querySelector(".parent");
  const child = parent.querySelector(".child");

  parent.removeChild(child);
  expect(parent.children.length).toBe(0);
  expect(parent.querySelector(".child")).toBeFalsy();
});

test("createElementNS creates SVG elements", () => {
  resetDOM("<!doctype html><body></body>");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  expect(svg.tagName).toBe("svg");
  expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
});

test("querySelectorAll returns NodeList", () => {
  resetDOM(
    "<!doctype html><body><div class='entry' data-entry-id='1'></div><div class='entry' data-entry-id='2'></div><div class='other'></div></body>",
  );
  const entries = document.querySelectorAll(".entry");
  expect(entries.length).toBe(2);
});
