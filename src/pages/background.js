import {
  refreshActionBehavior,
  DEFAULT_PERIOD_REFRESH,
  refreshEntries,
} from "./common";

// Create browser alarm to wakeup the background service.
browser.alarms.onAlarm.addListener(async (alarmInfo) => {
  console.log(alarmInfo);
  if (alarmInfo.name === ALARM_REFRESH) {
    await refreshEntries();
  }
});
browser.storage.local
  .get(["periodInMinutes"])
  .then((data) => {
    return Number(data.periodInMinutes || DEFAULT_PERIOD_REFRESH);
  })
  .then((periodInMinutes) => {
    browser.alarms.create("ALARM_REFRESH", {
      periodInMinutes: periodInMinutes,
    });
  });

// Refresh action behavior on startup.
refreshActionBehavior();

// Refresh entries at startup.
refreshEntries();
