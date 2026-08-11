/* global document, chrome, setTimeout, clearTimeout */

import "./localize.js";
import browser from "webextension-polyfill";
import {
  DEFAULT_BADGE_BACKGROUND_COLOR,
  DEFAULT_BADGE_TEXT_COLOR,
  DEFAULT_EXTENSION_CLICK_BEHAVIOR,
  DEFAULT_MARK_ENTRY_AS_READ_WHEN_OPENED_AS_TAB,
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

// ============================================================================
// DOM Element References
// ============================================================================

const elements = {
  url: () => document.querySelector("#inputMinifluxUrl"),
  token: () => document.querySelector("#inputMinifluxToken"),
  periodInMinutes: () =>
    document.querySelector("#inputMinifluxPeriodInMinutes"),
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
    "extensionClickBehavior",
    "markEntryAsReadWhenOpenedAsTab",
    "theme",
    "badgeBackgroundColor",
    "badgeTextColor",
    "showNotifications",
  ]);
}

/**
 * Read current values from form fields.
 * @returns {object}
 */
function readFormValues() {
  return {
    url: elements.url().value,
    token: elements.token().value,
    periodInMinutes: elements.periodInMinutes().valueAsNumber,
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

  if (changes.url || changes.token) {
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

/**
 * Debounced auto-save: saves form values after a short delay.
 */
async function debouncedSave() {
  if (isSaving) return;

  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(async () => {
    isSaving = true;
    try {
      const currentValues = readFormValues();
      const storedValues = await getStoredValues();
      await applyChanges(currentValues, storedValues);
    } catch {
      // Silently fail on auto-save
    } finally {
      isSaving = false;
      saveTimeout = null;
    }
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Populate form fields with stored values.
 */
async function restoreOptions() {
  const storedValues = await getStoredValues();

  elements.url().value = storedValues.url || DEFAULT_URL;
  elements.token().value = storedValues.token || DEFAULT_TOKEN;
  elements.periodInMinutes().valueAsNumber =
    storedValues.periodInMinutes || DEFAULT_PERIOD_REFRESH;
  elements.extensionClickBehavior().value =
    storedValues.extensionClickBehavior || DEFAULT_EXTENSION_CLICK_BEHAVIOR;
  elements.markEntryAsReadWhenOpenedAsTab().checked =
    storedValues.markEntryAsReadWhenOpenedAsTab ||
    DEFAULT_MARK_ENTRY_AS_READ_WHEN_OPENED_AS_TAB;
  elements.theme().value = storedValues.theme || DEFAULT_THEME;
  elements.badgeBackgroundColor().value =
    storedValues.badgeBackgroundColor || DEFAULT_BADGE_BACKGROUND_COLOR;
  elements.badgeTextColor().value =
    storedValues.badgeTextColor || DEFAULT_BADGE_TEXT_COLOR;

  const hasPermission = await browser.permissions.contains({
    permissions: ["notifications"],
  });
  const storedSetting =
    storedValues.showNotifications || DEFAULT_SHOW_NOTIFICATIONS;
  elements.showNotifications().checked = storedSetting && hasPermission;
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
  btnTest.innerText = chrome.i18n.getMessage("pageSettingsTesting");
  btnTest.disabled = true;
  btnTest.classList.remove("status-success", "status-error");

  return request("/v1/me", { url, token })
    .then(async (response) => {
      if (!response.ok) {
        btnTest.classList.add("status-error");
        btnTest.innerText = chrome.i18n.getMessage("pageSettingsTestError");
        throw new Error(await response.text());
      }

      btnTest.classList.add("status-success");
      btnTest.innerText = chrome.i18n.getMessage("pageSettingsTestOK");
    })
    .finally(() => {
      btnTest.disabled = false;
    });
}

/**
 * Remove all cached feed icons from local storage.
 * @returns {Promise<void>}
 */
async function clearIconsCache() {
  const data = await browser.storage.local.get(null);
  const keysToRemove = Object.keys(data).filter((key) =>
    /^icon\d+$/.test(key),
  );
  await browser.storage.local.remove(keysToRemove);
}

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([refreshTheme(), restoreOptions()]);

  // Attach auto-save listeners to input fields
  const autoSaveElements = [
    elements.url(),
    elements.token(),
    elements.periodInMinutes(),
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

  // Action buttons
  document
    .getElementById("btnTest")
    ?.addEventListener("click", testMinifluxApi);

  document
    .getElementById("btnCleanIconsCache")
    ?.addEventListener("click", clearIconsCache);
});
