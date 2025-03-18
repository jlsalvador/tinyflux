"use strict";

import browser from "webextension-polyfill";
import { ALARM_REFRESH, refreshActionBehavior, refreshEntries } from "./common";

// Create browser alarm to wakeup the background service.
browser.alarms.onAlarm.addListener((alarmInfo) => {
  if (alarmInfo.name === ALARM_REFRESH) {
    return refreshEntries();
  }
});

(async () => {
  console.log("Extension started.");
  await Promise.all([refreshActionBehavior(), refreshEntries()]);
})();
