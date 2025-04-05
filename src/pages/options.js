/* global document */

import browser from "webextension-polyfill";
import {
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

  const [
    oldUrl,
    oldToken,
    oldPeriodInMinutes,
    oldExtensionClickBehavior,
    oldTheme,
  ] = await browser.storage.local
    .get(["url", "token", "periodInMinutes", "extensionClickBehavior", "theme"])
    .then((r) => [
      r.url,
      r.token,
      r.periodInMinutes,
      r.extensionClickBehavior,
      r.theme,
    ]);

  await browser.storage.local.set({
    url: url,
    token: token,
    periodInMinutes: periodInMinutes,
    extensionClickBehavior: extensionClickBehavior,
    markEntryAsReadWhenOpenedAsTab: markEntryAsReadWhenOpenedAsTab,
    theme: theme,
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
}

async function restoreOptions() {
  const res = await browser.storage.local.get([
    "url",
    "token",
    "periodInMinutes",
    "extensionClickBehavior",
    "markEntryAsReadWhenOpenedAsTab",
    "theme",
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
}

async function testMinifluxApi() {
  const url = document.querySelector("#inputMinifluxUrl").value;
  const token = document.querySelector("#inputMinifluxToken").value;

  const btnTest = document.getElementById("btnTest");
  btnTest.innerText = "Testing …";
  btnTest.disabled = "disabled";
  btnTest.classList.remove("btn-success", "btn-danger");

  return request("/v1/me", { url: url, token: token })
    .then(async (response) => {
      if (!response.ok) {
        btnTest.classList.add("btn-danger");
        btnTest.innerText = "Error, try again?";
        throw new Error(await response.text());
      }

      btnTest.classList.add("btn-success");
      btnTest.innerText = "Test OK";
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
