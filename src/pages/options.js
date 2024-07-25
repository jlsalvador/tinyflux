import browser from "webextension-polyfill";
import {
  DEFAULT_PERIOD_REFRESH,
  DEFAULT_TOKEN,
  DEFAULT_URL,
  refreshEntries,
  request,
} from "./common.js";

async function saveOptions(e) {
  e.preventDefault();

  const url = document.querySelector("#inputMinifluxUrl").value;
  const token = document.querySelector("#inputMinifluxToken").value;
  const periodInMinutes = document.querySelector(
    "#inputMinifluxPeriodInMinutes"
  ).valueAsNumber;

  const res = await browser.storage.local.get(["url", "token"]);
  const oldUrl = res.url;
  const oldToken = res.token;

  await browser.storage.local.set({
    url: url,
    token: token,
    periodInMinutes: periodInMinutes,
  });

  if (url != oldUrl || token != oldToken) {
    refreshEntries();
  }
}

async function restoreOptions() {
  let res;

  res = await browser.storage.local.get("url");
  document.querySelector("#inputMinifluxUrl").value = res.url || DEFAULT_URL;

  res = await browser.storage.local.get("token");
  document.querySelector("#inputMinifluxToken").value =
    res.token || DEFAULT_TOKEN;

  res = await browser.storage.local.get("periodInMinutes");
  document.querySelector("#inputMinifluxPeriodInMinutes").valueAsNumber =
    res.periodInMinutes || DEFAULT_PERIOD_REFRESH;
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

document.addEventListener("DOMContentLoaded", () => {
  restoreOptions();

  const domForm = document.querySelector("form");
  domForm.addEventListener("submit", saveOptions);

  const btnTest = document.getElementById("btnTest");
  btnTest.addEventListener("click", testMinifluxApi);

  const btnClearIconsCache = document.getElementById("btnCleanIconsCache");
  btnClearIconsCache.addEventListener("click", clearIconsCache);
});
