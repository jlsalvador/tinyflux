/* global document, chrome, console, setTimeout, clearTimeout */

import "./localize.js";
import browser from "webextension-polyfill";
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
  DEFAULT_SHOW_NOTIFICATIONS,
  notifyRefreshTheme,
  refreshActionBehavior,
  refreshAlarm,
  refreshEntries,
  refreshTheme,
  request,
  updateBadgeColor,
} from "./common.js";

// ============================================================================
// Constants & State
// ============================================================================

const SAVE_DEBOUNCE_MS = 500;

/** @type {ReturnType<typeof setTimeout>|null} */
let saveTimeout = null;
let isSaving = false;
let savePending = false;

// ============================================================================
// DOM Element References
// ============================================================================

const elements = {
  url: () => document.querySelector("#inputMinifluxUrl"),
  token: () => document.querySelector("#inputMinifluxToken"),
  periodInMinutes: () =>
    document.querySelector("#inputMinifluxPeriodInMinutes"),
  maxEntries: () => document.querySelector("#inputMinifluxMaxEntries"),
  extensionClickBehavior: () =>
    document.querySelector("#selectExtensionClickBehavior"),
  markEntryAsReadWhenOpenedAsTab: () =>
    document.querySelector("#checkMarkEntryAsReadWhenOpenedAsTab"),
  theme: () => document.querySelector("#selectTheme"),
  badgeBackgroundColor: () =>
    document.querySelector("#inputBadgeBackgroundColor"),
  badgeTextColor: () => document.querySelector("#inputBadgeTextColor"),
  showNotifications: () => document.querySelector("#checkShowNotifications"),
};

// ============================================================================
// Storage Helpers
// ============================================================================

/**
 * Retrieve all stored settings values.
 * @returns {Promise<object>}
 */
async function getStoredValues() {
  return browser.storage.local.get([
    "url",
    "token",
    "periodInMinutes",
    "maxEntries",
    "extensionClickBehavior",
    "markEntryAsReadWhenOpenedAsTab",
    "theme",
    "badgeBackgroundColor",
    "badgeTextColor",
    "showNotifications",
  ]);
}

/**
 * Read a numeric form field, mapping an empty/invalid value to `null` so it
 * can be stored safely (downstream resolvers fall back to their defaults)
 * and does not trigger spurious "changed" comparisons (`NaN !== NaN`).
 * @param {HTMLInputElement} input
 * @returns {number|null}
 */
const readNumberOrNull = (input) =>
  Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : null;

/**
 * Read current values from form fields.
 * @returns {object}
 */
function readFormValues() {
  return {
    url: elements.url().value,
    token: elements.token().value,
    periodInMinutes: readNumberOrNull(elements.periodInMinutes()),
    maxEntries: readNumberOrNull(elements.maxEntries()),
    extensionClickBehavior: elements.extensionClickBehavior().value,
    markEntryAsReadWhenOpenedAsTab:
      elements.markEntryAsReadWhenOpenedAsTab().checked,
    theme: elements.theme().value,
    badgeBackgroundColor: elements.badgeBackgroundColor().value,
    badgeTextColor: elements.badgeTextColor().value,
    showNotifications: elements.showNotifications().checked,
  };
}

// ============================================================================
// Settings Persistence
// ============================================================================

/**
 * Save changed settings and trigger side effects (refresh, badge update, etc.).
 * @param {object} currentValues
 * @param {object} storedValues
 */
async function applyChanges(currentValues, storedValues) {
  const changes = {};
  for (const key of Object.keys(currentValues)) {
    if (currentValues[key] !== storedValues[key]) {
      changes[key] = true;
    }
  }

  await browser.storage.local.set(currentValues);

  if (
    (changes.url || changes.token || changes.maxEntries) &&
    currentValues.url &&
    currentValues.token
  ) {
    await refreshEntries();
  }

  if (changes.extensionClickBehavior) {
    await refreshActionBehavior();
  }

  if (changes.periodInMinutes) {
    await refreshAlarm();
  }

  if (changes.theme) {
    await refreshTheme();
    await notifyRefreshTheme();
  }

  if (changes.badgeBackgroundColor || changes.badgeTextColor) {
    await updateBadgeColor();
  }
}

/** Hide the "Saved" indicator after a short delay. */
let saveIndicatorTimeout = null;

function showSaveIndicator() {
  const indicator = document.getElementById("saveIndicator");
  if (!indicator) return;

  indicator.classList.add("is-visible");
  if (saveIndicatorTimeout) {
    clearTimeout(saveIndicatorTimeout);
  }
  saveIndicatorTimeout = setTimeout(() => {
    indicator.classList.remove("is-visible");
  }, 2000);
}

/**
 * Debounced auto-save: saves form values after a short delay.
 * Edits made while a save is in progress are queued and saved once it finishes.
 */
async function debouncedSave() {
  if (isSaving) {
    savePending = true;
    return;
  }

  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(async () => {
    saveTimeout = null;
    isSaving = true;
    try {
      const currentValues = readFormValues();
      const storedValues = await getStoredValues();
      await applyChanges(currentValues, storedValues);
      showSaveIndicator();
    } catch (error) {
      console.warn("Failed to save options:", error);
    } finally {
      isSaving = false;
      if (savePending) {
        savePending = false;
        debouncedSave();
      }
    }
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Populate form fields with stored values.
 */
async function restoreOptions() {
  const storedValues = await getStoredValues();

  // Use nullish coalescing so an explicitly stored falsy value (e.g. `false`)
  // is honored instead of being replaced by the default.
  elements.url().value = storedValues.url ?? DEFAULT_URL;
  elements.token().value = storedValues.token ?? DEFAULT_TOKEN;
  elements.periodInMinutes().valueAsNumber =
    storedValues.periodInMinutes ?? DEFAULT_PERIOD_REFRESH;
  elements.maxEntries().valueAsNumber =
    storedValues.maxEntries ?? DEFAULT_MAX_ENTRIES;
  elements.extensionClickBehavior().value =
    storedValues.extensionClickBehavior ?? DEFAULT_EXTENSION_CLICK_BEHAVIOR;
  elements.markEntryAsReadWhenOpenedAsTab().checked =
    storedValues.markEntryAsReadWhenOpenedAsTab ??
    DEFAULT_MARK_ENTRY_AS_READ_WHEN_OPENED_AS_TAB;
  elements.theme().value = storedValues.theme ?? DEFAULT_THEME;
  elements.badgeBackgroundColor().value =
    storedValues.badgeBackgroundColor ?? DEFAULT_BADGE_BACKGROUND_COLOR;
  elements.badgeTextColor().value =
    storedValues.badgeTextColor ?? DEFAULT_BADGE_TEXT_COLOR;

  const hasPermission = await browser.permissions.contains({
    permissions: ["notifications"],
  });
  const storedSetting =
    storedValues.showNotifications ?? DEFAULT_SHOW_NOTIFICATIONS;
  elements.showNotifications().checked = storedSetting && hasPermission;
}

// ============================================================================
// UI Helpers
// ============================================================================

/**
 * Get an i18n message, falling back to the provided text when the message is
 * missing (consistent with localize.js, so UI labels never go blank).
 * @param {string} key
 * @param {string} fallback
 * @returns {string}
 */
const i18n = (key, fallback) => chrome.i18n.getMessage(key) || fallback;

/**
 * Enable or disable the Test Connection button based on URL and Token values.
 * A previous test result is cleared when the credentials change.
 */
function updateTestButtonState() {
  const url = elements.url().value;
  const token = elements.token().value;
  const btnTest = document.getElementById("btnTest");
  if (!btnTest) return;

  btnTest.disabled = !url || !token;

  if (
    btnTest.classList.contains("status-success") ||
    btnTest.classList.contains("status-error")
  ) {
    btnTest.classList.remove("status-success", "status-error");
    btnTest.innerText = i18n(
      "pageSettingsMinifluxInstanceTestConnection",
      "Test Connection",
    );
  }
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Test Miniflux API connection with provided credentials.
 * @returns {Promise<void>}
 */
async function testMinifluxApi() {
  const url = elements.url().value;
  const token = elements.token().value;

  const btnTest = document.getElementById("btnTest");
  btnTest.innerText = i18n("pageSettingsTesting", "Testing …");
  btnTest.disabled = true;
  btnTest.classList.remove("status-success", "status-error");

  try {
    const response = await request("/v1/me", { url, token });

    if (!response.ok) {
      btnTest.classList.add("status-error");
      btnTest.innerText = i18n(
        "pageSettingsTestError",
        "Test failed. Try again?",
      );
      return;
    }

    btnTest.classList.add("status-success");
    btnTest.innerText = i18n("pageSettingsTestOK", "Test OK");
  } catch (error) {
    btnTest.classList.add("status-error");
    btnTest.innerText = i18n(
      "pageSettingsTestError",
      "Test failed. Try again?",
    );
    console.error("Failed to test Miniflux API:", error);
  } finally {
    btnTest.disabled = false;
  }
}

/**
 * Remove all cached feed icons from local storage and show transient feedback.
 * @returns {Promise<void>}
 */
async function clearIconsCache() {
  const btn = document.getElementById("btnCleanIconsCache");
  const originalText = btn?.innerText || "Clear FavIcons Cache";
  if (btn) btn.disabled = true;

  const data = await browser.storage.local.get(null);
  const keysToRemove = Object.keys(data).filter((key) => /^icon\d+$/.test(key));
  await browser.storage.local.remove(keysToRemove);

  if (btn) {
    btn.innerText = i18n(
      "pageSettingsMinifluxInstanceFaviconsCacheCleared",
      "Favicons cache cleared.",
    );
    setTimeout(() => {
      btn.innerText = originalText;
      btn.disabled = false;
    }, 2000);
  }
}

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener("DOMContentLoaded", async () => {
  // Prevent implicit form submission (e.g. pressing Enter in a text field),
  // which would reload the page and discard unsaved edits.
  document
    .querySelector("form")
    ?.addEventListener("submit", (event) => event.preventDefault());

  await Promise.all([refreshTheme(), restoreOptions()]);
  updateTestButtonState();

  // Attach auto-save listeners to input fields
  const autoSaveElements = [
    elements.url(),
    elements.token(),
    elements.periodInMinutes(),
    elements.maxEntries(),
    elements.extensionClickBehavior(),
    elements.markEntryAsReadWhenOpenedAsTab(),
    elements.theme(),
    elements.badgeBackgroundColor(),
    elements.badgeTextColor(),
  ];

  for (const el of autoSaveElements) {
    el.addEventListener("input", debouncedSave);
    el.addEventListener("change", debouncedSave);
  }

  // Update Test Connection button state on URL/Token input
  for (const el of [elements.url(), elements.token()]) {
    el.addEventListener("input", updateTestButtonState);
  }

  // Notification permission toggle
  elements.showNotifications().addEventListener("change", async (event) => {
    const checkbox = event.target;

    if (checkbox.checked) {
      const granted = await browser.permissions.request({
        permissions: ["notifications"],
      });

      if (!granted) {
        checkbox.checked = false;
        return;
      }
    } else {
      await browser.permissions.remove({
        permissions: ["notifications"],
      });
    }

    debouncedSave();
  });

  // Toggle token visibility
  const btnToggleToken = document.getElementById("btnToggleToken");
  btnToggleToken?.addEventListener("click", () => {
    const tokenInput = elements.token();
    const isHidden = tokenInput.type === "password";
    tokenInput.type = isHidden ? "text" : "password";
    btnToggleToken.innerText = i18n(
      isHidden ? "pageSettingsHideToken" : "pageSettingsShowToken",
      isHidden ? "Hide" : "Show",
    );
  });

  // Action buttons
  document
    .getElementById("btnTest")
    ?.addEventListener("click", testMinifluxApi);

  document
    .getElementById("btnCleanIconsCache")
    ?.addEventListener("click", clearIconsCache);
});
