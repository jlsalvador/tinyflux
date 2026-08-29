/* global test, expect, browser, fakeClock, resetDOM, document, window */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_BADGE_BACKGROUND_COLOR,
  DEFAULT_BADGE_TEXT_COLOR,
  DEFAULT_EXTENSION_CLICK_BEHAVIOR,
  DEFAULT_MARK_ENTRY_AS_READ_WHEN_OPENED_AS_TAB,
  DEFAULT_MAX_ENTRIES,
  DEFAULT_PERIOD_REFRESH,
  DEFAULT_THEME,
  DEFAULT_TOKEN,
  DEFAULT_URL,
} from "./common.js";
import "./options.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const optionsHtml = readFileSync(resolve(__dirname, "options.html"), "utf8");

// ============================================================================
// Helpers
// ============================================================================

const fullDefaults = {
  url: "https://miniflux.example.com",
  token: "test-token",
  periodInMinutes: DEFAULT_PERIOD_REFRESH,
  maxEntries: DEFAULT_MAX_ENTRIES,
  extensionClickBehavior: DEFAULT_EXTENSION_CLICK_BEHAVIOR,
  markEntryAsReadWhenOpenedAsTab: DEFAULT_MARK_ENTRY_AS_READ_WHEN_OPENED_AS_TAB,
  theme: DEFAULT_THEME,
  badgeBackgroundColor: DEFAULT_BADGE_BACKGROUND_COLOR,
  badgeTextColor: DEFAULT_BADGE_TEXT_COLOR,
  showNotifications: false,
};

const flushMicrotasks = async () => {
  for (let i = 0; i < 100; i += 1) {
    await Promise.resolve();
  }
};

const mockStorage = (t, data = {}) => {
  const store = { ...data };
  const sets = [];
  const removes = [];
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
  t.mock.method(browser.storage.local, "set", (items) => {
    sets.push(items);
    Object.assign(store, items);
    return Promise.resolve();
  });
  t.mock.method(browser.storage.local, "remove", (keys) => {
    removes.push(keys);
    return Promise.resolve();
  });
  return { sets, removes };
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

// Loads the real options.html and fires DOMContentLoaded so the page
// initialization (restoreOptions, theme, listeners) runs exactly once
const loadOptionsPage = async () => {
  resetDOM(optionsHtml);
  document.dispatchEvent(new window.Event("DOMContentLoaded"));
  await flushMicrotasks();
};

// ============================================================================
// restoreOptions tests
// ============================================================================

test("restoreOptions populates the form from stored values", async (t) => {
  mockStorage(t, {
    ...fullDefaults,
    periodInMinutes: 30,
    maxEntries: 250,
    extensionClickBehavior: "sidepanel",
    markEntryAsReadWhenOpenedAsTab: true,
    theme: "dark",
    badgeBackgroundColor: "#ff0000",
    badgeTextColor: "#00ff00",
    showNotifications: true,
  });
  t.mock.method(browser.permissions, "contains", () => Promise.resolve(true));
  await loadOptionsPage();

  expect(document.getElementById("inputMinifluxUrl").value).toBe(
    "https://miniflux.example.com",
  );
  expect(document.getElementById("inputMinifluxToken").value).toBe(
    "test-token",
  );
  expect(
    document.getElementById("inputMinifluxPeriodInMinutes").valueAsNumber,
  ).toBe(30);
  expect(document.getElementById("inputMinifluxMaxEntries").valueAsNumber).toBe(
    250,
  );
  expect(document.getElementById("selectExtensionClickBehavior").value).toBe(
    "sidepanel",
  );
  expect(
    document.getElementById("checkMarkEntryAsReadWhenOpenedAsTab").checked,
  ).toBe(true);
  expect(document.getElementById("selectTheme").value).toBe("dark");
  expect(document.getElementById("inputBadgeBackgroundColor").value).toBe(
    "#ff0000",
  );
  expect(document.getElementById("inputBadgeTextColor").value).toBe("#00ff00");
  expect(document.getElementById("checkShowNotifications").checked).toBe(true);
  expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
});

test("restoreOptions falls back to defaults when storage is empty", async (t) => {
  mockStorage(t);
  t.mock.method(browser.permissions, "contains", () => Promise.resolve(true));
  await loadOptionsPage();

  expect(document.getElementById("inputMinifluxUrl").value).toBe(DEFAULT_URL);
  expect(document.getElementById("inputMinifluxToken").value).toBe(
    DEFAULT_TOKEN,
  );
  expect(
    document.getElementById("inputMinifluxPeriodInMinutes").valueAsNumber,
  ).toBe(DEFAULT_PERIOD_REFRESH);
  expect(document.getElementById("inputMinifluxMaxEntries").valueAsNumber).toBe(
    DEFAULT_MAX_ENTRIES,
  );
  expect(document.getElementById("selectExtensionClickBehavior").value).toBe(
    DEFAULT_EXTENSION_CLICK_BEHAVIOR,
  );
  expect(
    document.getElementById("checkMarkEntryAsReadWhenOpenedAsTab").checked,
  ).toBe(DEFAULT_MARK_ENTRY_AS_READ_WHEN_OPENED_AS_TAB);
  expect(document.getElementById("selectTheme").value).toBe(DEFAULT_THEME);
  expect(document.getElementById("inputBadgeBackgroundColor").value).toBe(
    DEFAULT_BADGE_BACKGROUND_COLOR,
  );
  expect(document.getElementById("inputBadgeTextColor").value).toBe(
    DEFAULT_BADGE_TEXT_COLOR,
  );
  expect(document.getElementById("checkShowNotifications").checked).toBe(false);
  expect(document.documentElement.getAttribute("data-theme")).toBe(
    DEFAULT_THEME,
  );
});

test("restoreOptions keeps notifications unchecked without permission", async (t) => {
  mockStorage(t, { ...fullDefaults, showNotifications: true });
  t.mock.method(browser.permissions, "contains", () => Promise.resolve(false));
  await loadOptionsPage();

  expect(document.getElementById("checkShowNotifications").checked).toBe(false);
});

// ============================================================================
// Test connection button tests
// ============================================================================

test("test connection button is disabled without credentials", async (t) => {
  mockStorage(t);
  await loadOptionsPage();

  expect(document.getElementById("btnTest").disabled).toBe(true);
});

test("test connection shows success on a valid response", async (t) => {
  mockStorage(t, { ...fullDefaults });
  const fetched = mockFetch(t, { id: 1 });
  await loadOptionsPage();

  const btnTest = document.getElementById("btnTest");
  expect(btnTest.disabled).toBe(false);

  btnTest.click();
  await flushMicrotasks();

  expect(fetched.length).toBe(1);
  expect(fetched[0].url).toBe("https://miniflux.example.com/v1/me");
  expect(btnTest.classList.contains("status-success")).toBe(true);
  expect(btnTest.innerText).toBe("pageSettingsTestOK");
  expect(btnTest.disabled).toBe(false);
});

test("test connection shows error on an invalid response", async (t) => {
  mockStorage(t, { ...fullDefaults, token: "bad-token" });
  const fetched = mockFetch(t, {}, 401);
  await loadOptionsPage();

  const btnTest = document.getElementById("btnTest");
  btnTest.click();
  await flushMicrotasks();

  expect(fetched[0].url).toBe("https://miniflux.example.com/v1/me");
  expect(btnTest.classList.contains("status-error")).toBe(true);
  expect(btnTest.innerText).toBe("pageSettingsTestError");
  expect(btnTest.disabled).toBe(false);
});

test("url input clears a previous successful test result", async (t) => {
  fakeClock(t);
  mockStorage(t, { ...fullDefaults });
  mockFetch(t, { id: 1 });
  await loadOptionsPage();

  const btnTest = document.getElementById("btnTest");
  btnTest.click();
  await flushMicrotasks();
  expect(btnTest.classList.contains("status-success")).toBe(true);

  const urlInput = document.getElementById("inputMinifluxUrl");
  urlInput.value = "https://changed.example.com";
  urlInput.dispatchEvent(new window.Event("input"));
  await flushMicrotasks();

  expect(btnTest.classList.contains("status-success")).toBe(false);
  expect(btnTest.innerText).toBe("pageSettingsMinifluxInstanceTestConnection");
});

// ============================================================================
// Auto-save tests
// ============================================================================

test("autosave persists url change after debounce and refreshes entries", async (t) => {
  const clock = fakeClock(t);
  const { sets } = mockStorage(t, {
    ...fullDefaults,
    url: "https://old.example.com",
  });
  const fetched = mockFetch(t, { entries: [] });
  await loadOptionsPage();

  const urlInput = document.getElementById("inputMinifluxUrl");
  urlInput.value = "https://new.example.com";
  urlInput.dispatchEvent(new window.Event("input"));

  expect(sets.length).toBe(0);

  clock.tick(500);
  await flushMicrotasks();

  expect(sets.length).toBe(2);
  expect(sets[0].url).toBe("https://new.example.com");
  expect(sets[0].token).toBe("test-token");
  expect(sets[0].showNotifications).toBe(false);
  expect(sets[1].entries).toEqual([]);
  expect(fetched.length).toBe(1);
  expect(fetched[0].url).toBe(
    "https://new.example.com/v1/entries?status=unread&order=published_at&direction=desc&limit=100",
  );
});

test("autosave refetches entries with the new limit when maxEntries changes", async (t) => {
  const clock = fakeClock(t);
  const { sets } = mockStorage(t, { ...fullDefaults });
  const fetched = mockFetch(t, { entries: [] });
  await loadOptionsPage();

  const maxInput = document.getElementById("inputMinifluxMaxEntries");
  maxInput.valueAsNumber = 250;
  maxInput.dispatchEvent(new window.Event("input"));

  clock.tick(500);
  await flushMicrotasks();

  expect(sets.length).toBe(2);
  expect(sets[0].maxEntries).toBe(250);
  expect(sets[1].entries).toEqual([]);
  expect(fetched.length).toBe(1);
  expect(fetched[0].url).toBe(
    "https://miniflux.example.com/v1/entries?status=unread&order=published_at&direction=desc&limit=250",
  );
});

test("autosave stores null for an emptied numeric input", async (t) => {
  const clock = fakeClock(t);
  const { sets } = mockStorage(t, { ...fullDefaults });
  const alarms = [];
  t.mock.method(browser.alarms, "create", (name, info) => {
    alarms.push([name, info]);
    return Promise.resolve();
  });
  await loadOptionsPage();

  const periodInput = document.getElementById("inputMinifluxPeriodInMinutes");
  periodInput.value = "";
  periodInput.dispatchEvent(new window.Event("input"));

  clock.tick(500);
  await flushMicrotasks();

  // The empty field is stored as null (not NaN) so the value round-trips
  // through storage and invalid-value resolvers fall back to their defaults.
  expect(sets.length).toBe(1);
  expect(sets[0].periodInMinutes).toBe(null);
  // The (invalid) stored value falls back to the default refresh period.
  expect(alarms.length).toBe(1);
  expect(alarms[0][1].periodInMinutes).toBe(DEFAULT_PERIOD_REFRESH);
});

test("autosave updates badge colors when only badge colors change", async (t) => {
  const clock = fakeClock(t);
  const { sets } = mockStorage(t, { ...fullDefaults });
  const fetched = mockFetch(t, { entries: [] });
  const badges = [];
  t.mock.method(browser.action, "setBadgeBackgroundColor", (options) => {
    badges.push(["background", options]);
    return Promise.resolve();
  });
  t.mock.method(browser.action, "setBadgeTextColor", (options) => {
    badges.push(["text", options]);
    return Promise.resolve();
  });
  await loadOptionsPage();

  const colorInput = document.getElementById("inputBadgeBackgroundColor");
  colorInput.value = "#123456";
  colorInput.dispatchEvent(new window.Event("input"));

  clock.tick(500);
  await flushMicrotasks();

  expect(sets.length).toBe(1);
  expect(sets[0].badgeBackgroundColor).toBe("#123456");
  expect(badges.length).toBe(2);
  expect(badges[0]).toEqual(["background", { color: "#123456" }]);
  expect(badges[1]).toEqual(["text", { color: DEFAULT_BADGE_TEXT_COLOR }]);
  expect(fetched.length).toBe(0);
});

// ============================================================================
// Notification permission toggle tests
// ============================================================================

test("show notifications toggle requests permission and saves", async (t) => {
  const clock = fakeClock(t);
  const { sets } = mockStorage(t, { ...fullDefaults });
  const requested = [];
  t.mock.method(browser.permissions, "request", (options) => {
    requested.push(options);
    return Promise.resolve(true);
  });
  await loadOptionsPage();

  const checkbox = document.getElementById("checkShowNotifications");
  checkbox.checked = true;
  checkbox.dispatchEvent(new window.Event("change"));
  await flushMicrotasks();

  expect(requested.length).toBe(1);
  expect(requested[0]).toEqual({ permissions: ["notifications"] });
  expect(checkbox.checked).toBe(true);

  clock.tick(500);
  await flushMicrotasks();

  expect(sets.length).toBe(1);
  expect(sets[0].showNotifications).toBe(true);
});

test("show notifications toggle reverts when permission is denied", async (t) => {
  fakeClock(t);
  const { sets } = mockStorage(t, { ...fullDefaults });
  t.mock.method(browser.permissions, "request", () => Promise.resolve(false));
  await loadOptionsPage();

  const checkbox = document.getElementById("checkShowNotifications");
  checkbox.checked = true;
  checkbox.dispatchEvent(new window.Event("change"));
  await flushMicrotasks();

  expect(checkbox.checked).toBe(false);
  expect(sets.length).toBe(0);
});

test("show notifications toggle removes permission when unchecked", async (t) => {
  fakeClock(t);
  mockStorage(t, { ...fullDefaults, showNotifications: true });
  t.mock.method(browser.permissions, "contains", () => Promise.resolve(true));
  const removed = [];
  t.mock.method(browser.permissions, "remove", (options) => {
    removed.push(options);
    return Promise.resolve(true);
  });
  await loadOptionsPage();

  const checkbox = document.getElementById("checkShowNotifications");
  expect(checkbox.checked).toBe(true);

  checkbox.checked = false;
  checkbox.dispatchEvent(new window.Event("change"));
  await flushMicrotasks();

  expect(removed.length).toBe(1);
  expect(removed[0]).toEqual({ permissions: ["notifications"] });
});

// ============================================================================
// Clear favicons cache tests
// ============================================================================

test("clear favicons cache removes only icon keys", async (t) => {
  const { removes } = mockStorage(t, {
    icon1: { data: "icon1" },
    icon42: { data: "icon42" },
    url: "https://miniflux.example.com",
    theme: "dark",
  });
  await loadOptionsPage();

  document.getElementById("btnCleanIconsCache").click();
  await flushMicrotasks();

  expect(removes.length).toBe(1);
  expect(removes[0]).toEqual(["icon1", "icon42"]);
});
