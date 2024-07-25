import browser from "webextension-polyfill";
import { refreshEntries } from "./common";
import { DEFAULT_PERIOD_REFRESH } from "./common";

const ALARM_REFRESH = "ALARM_REFRESH";

async function handleAlarm(alarmInfo) {
  console.log(alarmInfo);
  if (alarmInfo.name === ALARM_REFRESH) {
    await refreshEntries();
  }
}

async function init() {
  const periodInMinutes = await browser.storage.local
    .get("periodInMinutes")
    .then((r) => Number(r.periodInMinutes || DEFAULT_PERIOD_REFRESH));

  browser.alarms.onAlarm.addListener(handleAlarm);
  browser.alarms.create(ALARM_REFRESH, {
    when: Date.now(),
    periodInMinutes: periodInMinutes,
  });
}

init();
