import { refreshAlarm, refreshActionBehavior, refreshEntries } from "./common";

// Create browser alarm to wakeup the background service.
browser.alarms.onAlarm.addListener(async (alarmInfo) => {
  if (alarmInfo.name === ALARM_REFRESH) {
    await refreshEntries();
  }
});
refreshAlarm();

// Refresh action behavior on startup.
refreshActionBehavior();

// Refresh entries at startup.
refreshEntries();
