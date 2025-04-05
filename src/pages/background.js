/* global console */

"use strict";

import browser from "webextension-polyfill";
import {
  ALARM_REFRESH,
  MESSAGE_MARK_ENTRY_IDS_AS_READ,
  notifyRefreshEntries,
  refreshActionBehavior,
  refreshEntries,
  request,
  updateBadge,
} from "./common";

/**
 * @typedef {import('./common.js').Entry} Entry
 * @typedef {import('./common.js').ErrorInvalidUrlOrToken} ErrorInvalidUrlOrToken
 */

/**
 * Removes multiple entry IDs from the Miniflux instance, update local cache,
 * notify refresh, and update badge.
 *
 * @param {Number[]} entryIds
 * @returns {Entry[]}
 * @throws {Error}
 */
const markEntryIdAsRead = async (entryIds) => {
  /**
   * Mark an entry as read in the Miniflux instance.
   *
   * @param {Number[]} entryIds
   * @returns {Promise<void>}
   * @throws {ErrorInvalidUrlOrToken|AbortError|TypeError}
   */
  const markMinifluxEntryAsRead = (entryIds) => {
    return request(`/v1/entries`, {
      method: "PUT",
      body: JSON.stringify({ entry_ids: entryIds, status: "read" }),
    });
  };

  await markMinifluxEntryAsRead(entryIds);
  return browser.storage.local
    .get("entries")
    .then((data) => data.entries)
    .then((entries) => entries.filter((e) => entryIds.indexOf(e.id) === -1))
    .then(async (entries) => {
      await browser.storage.local.set({ entries: entries }); // Remove entries from the local cache.
      await Promise.all([notifyRefreshEntries(), updateBadge()]);
      return entries;
    });
};

const handleStartup = async () => {
  console.log("Extension started.");
  await Promise.all([refreshActionBehavior(), refreshEntries()]);
};
const handleInstalled = handleStartup;
const handleMessage = (message) => {
  if (message.action === MESSAGE_MARK_ENTRY_IDS_AS_READ) {
    return markEntryIdAsRead(message.entryIds);
  } else {
    return false;
  }
};

browser.runtime.onStartup.addListener(handleStartup);
browser.runtime.onInstalled.addListener(handleInstalled);
browser.runtime.onMessage.addListener(handleMessage);

// Create browser alarm to wakeup the background service.
browser.alarms.onAlarm.addListener((alarmInfo) => {
  if (alarmInfo.name === ALARM_REFRESH) {
    return refreshEntries();
  }
});
