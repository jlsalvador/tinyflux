/* global document, chrome */

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
  notifyRefreshTheme,
  refreshActionBehavior,
  refreshAlarm,
  refreshEntries,
  refreshTheme,
  request,
  updateBadgeColor,
} from "./common.js";

async function saveOptions(e) {
  e.preventDefault();

  const url = document.querySelector("#inputMinifluxUrl").value;
  const token = document.querySelector("#inputMinifluxToken").value;
  const periodInMinutes = document.querySelector(
    "#inputMinifluxPeriodInMinutes",
  ).valueAsNumber;
  const extensionClickBehavior = document.querySelector(
    "#selectExtensionClickBehavior",
  ).value;
  const markEntryAsReadWhenOpenedAsTab = document.querySelector(
    "#checkMarkEntryAsReadWhenOpenedAsTab",
  ).checked;
  const theme = document.querySelector("#selectTheme").value;
  const badgeBackgroundColor = document.querySelector(
    "#inputBadgeBackgroundColor",
  ).value;
  const badgeTextColor = document.querySelector("#inputBadgeTextColor").value;

  const [
    oldUrl,
    oldToken,
    oldPeriodInMinutes,
    oldExtensionClickBehavior,
    oldTheme,
    oldBackgroundColor,
    oldBadgeTextColor,
  ] = await browser.storage.local
    .get([
      "url",
      "token",
      "periodInMinutes",
      "extensionClickBehavior",
      "theme",
      "badgeBackgroundColor",
      "badgeTextColor",
    ])
    .then((r) => [
      r.url,
      r.token,
      r.periodInMinutes,
      r.extensionClickBehavior,
      r.theme,
      r.badgeBackgroundColor,
      r.badgeTextColor,
    ]);

  await browser.storage.local.set({
    url: url,
    token: token,
    periodInMinutes: periodInMinutes,
    extensionClickBehavior: extensionClickBehavior,
    markEntryAsReadWhenOpenedAsTab: markEntryAsReadWhenOpenedAsTab,
    theme: theme,
    badgeBackgroundColor: badgeBackgroundColor,
    badgeTextColor: badgeTextColor,
  });

  if (url != oldUrl || token != oldToken) {
    await refreshEntries();
  }

  if (extensionClickBehavior != oldExtensionClickBehavior) {
    await refreshActionBehavior();
  }

  if (periodInMinutes != oldPeriodInMinutes) {
    await refreshAlarm();
  }

  if (theme != oldTheme) {
    await refreshTheme();
    await notifyRefreshTheme();
  }

  if (
    badgeBackgroundColor != oldBackgroundColor ||
    badgeTextColor != oldBadgeTextColor
  ) {
    await updateBadgeColor();
  }
}

async function restoreOptions() {
  const res = await browser.storage.local.get([
    "url",
    "token",
    "periodInMinutes",
    "extensionClickBehavior",
    "markEntryAsReadWhenOpenedAsTab",
    "theme",
    "badgeBackgroundColor",
    "badgeTextColor",
  ]);

  document.querySelector("#inputMinifluxUrl").value = res.url || DEFAULT_URL;

  document.querySelector("#inputMinifluxToken").value =
    res.token || DEFAULT_TOKEN;

  document.querySelector("#inputMinifluxPeriodInMinutes").valueAsNumber =
    res.periodInMinutes || DEFAULT_PERIOD_REFRESH;

  document.querySelector("#selectExtensionClickBehavior").value =
    res.extensionClickBehavior || DEFAULT_EXTENSION_CLICK_BEHAVIOR;

  document.querySelector("#checkMarkEntryAsReadWhenOpenedAsTab").checked =
    res.markEntryAsReadWhenOpenedAsTab ||
    DEFAULT_MARK_ENTRY_AS_READ_WHEN_OPENED_AS_TAB;

  document.querySelector("#selectTheme").value = res.theme || DEFAULT_THEME;

  document.querySelector("#inputBadgeBackgroundColor").value =
    res.badgeBackgroundColor || DEFAULT_BADGE_BACKGROUND_COLOR;

  document.querySelector("#inputBadgeTextColor").value =
    res.badgeTextColor || DEFAULT_BADGE_TEXT_COLOR;
}

async function testMinifluxApi() {
  const url = document.querySelector("#inputMinifluxUrl").value;
  const token = document.querySelector("#inputMinifluxToken").value;

  const btnTest = document.getElementById("btnTest");
  btnTest.innerText = chrome.i18n.getMessage("pageSettingsTesting");
  btnTest.disabled = true;
  btnTest.classList.remove("status-success", "status-error");

  return request("/v1/me", { url: url, token: token })
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
  return await browser.storage.local.get(null).then((data) => {
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

  const domForm = document.querySelector("form");
  domForm?.addEventListener("submit", saveOptions);

  const btnTest = document.getElementById("btnTest");
  btnTest?.addEventListener("click", testMinifluxApi);

  const btnClearIconsCache = document.getElementById("btnCleanIconsCache");
  btnClearIconsCache?.addEventListener("click", clearIconsCache);
});
