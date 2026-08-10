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

const SAVE_DEBOUNCE_MS = 500;

let saveTimeout = null;
let isSaving = false;

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

async function restoreOptions() {
  const res = await getStoredValues();

  elements.url().value = res.url || DEFAULT_URL;
  elements.token().value = res.token || DEFAULT_TOKEN;
  elements.periodInMinutes().valueAsNumber =
    res.periodInMinutes || DEFAULT_PERIOD_REFRESH;
  elements.extensionClickBehavior().value =
    res.extensionClickBehavior || DEFAULT_EXTENSION_CLICK_BEHAVIOR;
  elements.markEntryAsReadWhenOpenedAsTab().checked =
    res.markEntryAsReadWhenOpenedAsTab ||
    DEFAULT_MARK_ENTRY_AS_READ_WHEN_OPENED_AS_TAB;
  elements.theme().value = res.theme || DEFAULT_THEME;
  elements.badgeBackgroundColor().value =
    res.badgeBackgroundColor || DEFAULT_BADGE_BACKGROUND_COLOR;
  elements.badgeTextColor().value =
    res.badgeTextColor || DEFAULT_BADGE_TEXT_COLOR;

  const hasPermission = await browser.permissions.contains({
    permissions: ["notifications"],
  });
  const storedSetting = res.showNotifications || DEFAULT_SHOW_NOTIFICATIONS;
  elements.showNotifications().checked = storedSetting && hasPermission;
}

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

async function clearIconsCache() {
  return browser.storage.local.get(null).then((data) => {
    const keysToRemove = [];
    for (const key of Object.keys(data)) {
      if (/^icon\d+$/.test(key)) {
        keysToRemove.push(key);
      }
    }

    return browser.storage.local.remove(keysToRemove);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([refreshTheme(), restoreOptions()]);

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

  elements.showNotifications().addEventListener("change", async (e) => {
    const checkbox = e.target;

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

  document
    .getElementById("btnTest")
    ?.addEventListener("click", testMinifluxApi);

  document
    .getElementById("btnCleanIconsCache")
    ?.addEventListener("click", clearIconsCache);
});
