/* global document, window, Element, NodeList */

import test from "node:test";
import { resolve, dirname } from "node:path";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, "fixtures");

try {
  const entries = await readdir(fixturesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".js")) {
      const mod = await import(resolve(fixturesDir, entry.name));
      Object.assign(globalThis, mod);
    }
  }
} catch {
  /* no fixtures */
}

// DOM environment via jsdom
const dom = new JSDOM(
  "<!doctype html><html><head></head><body></body></html>",
  {
    url: "http://localhost/",
    pretendToBeVisual: true,
  },
);
globalThis.document = dom.window.document;
globalThis.window = dom.window;

// Tests run against a single shared jsdom window. Stub window.close() so
// production code paths that close the popup (openLink, openSettings, ...)
// cannot destroy it mid-suite; a closed window leaves the internal document
// null and breaks DOMParser in resetDOM.
dom.window.close = () => {};

globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.HTMLDivElement = dom.window.HTMLDivElement;
globalThis.SVGElement = dom.window.SVGElement;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;
globalThis.Text = dom.window.Text;
globalThis.Comment = dom.window.Comment;
globalThis.DocumentFragment = dom.window.DocumentFragment;
globalThis.MutationObserver = dom.window.MutationObserver;

// Mock DOMPurify to avoid requiring jsdom window setup
const mockDompurify = {
  sanitize: (html, options) => {
    if (options?.RETURN_DOM_FRAGMENT) {
      const temp = document.createElement("div");
      temp.innerHTML = html;
      const fragment = document.createDocumentFragment();
      while (temp.firstChild) {
        fragment.appendChild(temp.firstChild);
      }
      return fragment;
    }
    return html;
  },
  addHook: () => {},
  createWindow: () => dom.window,
};
Object.assign(globalThis, { DOMPurify: mockDompurify });

// Mock browser (webextension-polyfill)
const createMockPromise = (result) => () => Promise.resolve(result);
const addListener = () => {};
const removeListener = () => {};

// Capture runtime.onMessage listeners so tests can dispatch messages
const runtimeMessageListeners = [];

const mockBrowser = {
  storage: {
    local: {
      get: createMockPromise({}),
      getKeys: createMockPromise([]),
      set: createMockPromise(),
      remove: createMockPromise(),
    },
  },
  runtime: {
    onMessage: {
      addListener: (listener) => runtimeMessageListeners.push(listener),
      removeListener,
    },
    onStartup: { addListener, removeListener },
    onInstalled: { addListener, removeListener },
    onSuspend: { addListener, removeListener },
    sendMessage: createMockPromise(false),
    openOptionsPage: createMockPromise(),
    getURL: (path) => `http://localhost/${path}`,
    id: "test-extension-id",
  },
  sidebarAction: {
    toggle: createMockPromise(),
    close: createMockPromise(),
    open: createMockPromise(),
    setPanel: createMockPromise(),
    setIcon: createMockPromise(),
    setTitle: createMockPromise(),
    setToolTip: createMockPromise(),
  },
  action: {
    setTitle: createMockPromise(),
    setBadgeText: createMockPromise(),
    setBadgeBackgroundColor: createMockPromise(),
    setBadgeTextColor: createMockPromise(),
    setPopup: createMockPromise(),
    setIcon: createMockPromise(),
    setTheme: createMockPromise(),
    onClicked: { addListener, removeListener },
  },
  permissions: {
    contains: createMockPromise(false),
    request: createMockPromise(false),
    remove: createMockPromise(false),
  },
  tabs: {
    create: createMockPromise({ id: 1 }),
    query: createMockPromise([{ id: 1, windowId: 1 }]),
    update: createMockPromise({ id: 1 }),
    remove: createMockPromise(),
    discard: createMockPromise(),
  },
  windows: {
    create: createMockPromise({ id: 1 }),
    getCurrent: createMockPromise({ id: 1 }),
  },
  alarms: {
    clear: createMockPromise(true),
    clearAll: createMockPromise(),
    create: createMockPromise(),
    get: createMockPromise(null),
    getAll: createMockPromise([]),
    onAlarm: { addListener, removeListener },
  },
  notifications: {
    create: createMockPromise("notification-id"),
    clear: createMockPromise(true),
    getAll: createMockPromise([]),
    onClicked: { addListener, removeListener },
  },
  i18n: {
    getMessage: (key) => key,
  },
  contextMenus: {
    create: createMockPromise(),
    remove: createMockPromise(),
    removeAll: createMockPromise(),
  },
};
Object.assign(globalThis, { browser: mockBrowser });
globalThis.runtimeMessageListeners = runtimeMessageListeners;

// Mock fetch - returns a successful JSON response by default
globalThis.mockFetchResponse = {
  status: 200,
  ok: true,
  json: () => Promise.resolve({}),
};
globalThis.fetch = async () => globalThis.mockFetchResponse;

// Mock chrome (for APIs not in polyfill)
const mockChrome = {
  i18n: {
    getMessage: (key) => key,
  },
  sidePanel: {
    setPanelBehavior: createMockPromise(),
    open: createMockPromise(),
  },
  notifications: {
    create: createMockPromise("notification-id"),
  },
  tabs: {
    query: createMockPromise([{ id: 1, windowId: 1 }]),
  },
  runtime: {
    id: "test-extension-id",
    sendMessage: createMockPromise(false),
    getURL: (path) => `http://localhost/${path}`,
  },
};
Object.assign(globalThis, { chrome: mockChrome });

globalThis.test = test;
globalThis.expect = (actual) => ({
  toBe: (expected) => {
    if (actual !== expected) {
      throw new Error(
        `Expected ${JSON.stringify(actual)} toBe ${JSON.stringify(expected)}`,
      );
    }
  },
  toEqual: (expected) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(
        `Expected ${JSON.stringify(actual)} toEqual ${JSON.stringify(expected)}`,
      );
    }
  },
  toBeTruthy: () => {
    if (!actual) {
      throw new Error(`Expected ${JSON.stringify(actual)} to be truthy`);
    }
  },
  toBeFalsy: () => {
    if (actual) {
      throw new Error(`Expected ${JSON.stringify(actual)} to be falsy`);
    }
  },
  toContain: (expected) => {
    if (typeof actual !== "string" || !actual.includes(expected)) {
      throw new Error(
        `Expected ${JSON.stringify(actual)} toContain ${JSON.stringify(expected)}`,
      );
    }
  },
  toThrow: (expected) => {
    if (typeof actual !== "function") {
      throw new Error(`toThrow requires a function, got ${typeof actual}`);
    }
    let error = null;
    try {
      actual();
    } catch (e) {
      error = e;
    }
    if (!error) {
      throw new Error("Expected function to throw, but it did not");
    }
    if (typeof expected === "function" && !(error instanceof expected)) {
      throw new Error(
        `Expected error to be an instance of ${expected.name}, got ${error.name}`,
      );
    }
    if (typeof expected === "string" && !error.message.includes(expected)) {
      throw new Error(
        `Expected error message to contain "${expected}", got "${error.message}"`,
      );
    }
    return error;
  },
  toHaveClass: (className) => {
    if (!(actual instanceof Element) || !actual.classList.contains(className)) {
      throw new Error(
        `Expected element to have class "${className}", got "${actual?.className || "no class"}"`,
      );
    }
  },
  toHaveLength: (expected) => {
    if (!Array.isArray(actual) && !(actual instanceof NodeList)) {
      throw new Error(`Expected array or NodeList, got ${typeof actual}`);
    }
    if (actual.length !== expected) {
      throw new Error(`Expected length ${expected}, got ${actual.length}`);
    }
  },
  toHaveTextContent: (expected) => {
    if (typeof actual?.textContent !== "string") {
      throw new Error(`Expected element with textContent`);
    }
    if (!actual.textContent.includes(expected)) {
      throw new Error(
        `Expected text to contain "${expected}", got "${actual.textContent}"`,
      );
    }
  },
});

// Reset DOM between tests
import { before } from "node:test";

before(() => {
  // Setup runs once before all tests
});

// Helper to reset document content for each test. Uses DOMParser instead of
// document.open/write/close so DOMContentLoaded does not re-fire automatically;
// tests that need page initialization dispatch it explicitly.
globalThis.resetDOM = (html = "<!doctype html><body></body>") => {
  const parsed = new window.DOMParser().parseFromString(html, "text/html");
  while (document.firstChild) {
    document.firstChild.remove();
  }
  for (const node of Array.from(parsed.childNodes)) {
    document.appendChild(document.adoptNode(node));
  }
};

// Minimal fake clock for deterministic timer tests, replacing the
// experimental t.mock.timers API. Installs setTimeout/clearTimeout mocks for
// the test (originals auto-restore when the test ends) and returns a tick()
// helper that advances the clock and fires due callbacks in order. Timers
// scheduled by callbacks are picked up when they fall within the ticked
// window; clearing an unknown or already-fired id is a no-op, so stale ids
// leaking between tests are harmless. Usage:
//   const clock = fakeClock(t);   // or bare fakeClock(t) when no tick is
//                                 // needed (timers are just captured)
//   clock.tick(500);
globalThis.fakeClock = (t) => {
  const timers = new Map();
  let now = 0;
  let nextId = 1;

  t.mock.method(globalThis, "setTimeout", (callback, delay = 0, ...args) => {
    const id = nextId++;
    const wait = Number(delay) > 0 ? Number(delay) : 0;
    timers.set(id, { callback, due: now + wait, args });
    return id;
  });

  t.mock.method(globalThis, "clearTimeout", (id) => {
    timers.delete(id);
  });

  return {
    tick(ms) {
      const target = now + ms;
      for (;;) {
        let dueId = null;
        let dueTimer = null;
        for (const [id, timer] of timers) {
          if (
            timer.due <= target &&
            (dueTimer === null ||
              timer.due < dueTimer.due ||
              (timer.due === dueTimer.due && id < dueId))
          ) {
            dueId = id;
            dueTimer = timer;
          }
        }
        if (dueTimer === null) break;
        now = dueTimer.due;
        timers.delete(dueId);
        dueTimer.callback(...dueTimer.args);
      }
      now = target;
    },
  };
};
