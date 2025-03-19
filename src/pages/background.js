/* global console */

"use strict";

import browser from "webextension-polyfill";
import { ALARM_REFRESH, refreshActionBehavior, refreshEntries } from "./common";

const handleStartup = async () => {
  console.log("Extension started.");
  await Promise.all([refreshActionBehavior(), refreshEntries()]);
};
const handleInstalled = handleStartup;

// Create browser alarm to wakeup the background service.
browser.alarms.onAlarm.addListener((alarmInfo) => {
  if (alarmInfo.name === ALARM_REFRESH) {
    return refreshEntries();
  }
});

browser.runtime.onStartup.addListener(handleStartup);
browser.runtime.onInstalled.addListener(handleInstalled);
