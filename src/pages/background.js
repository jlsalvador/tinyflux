/* global console */

"use strict";

import browser from "webextension-polyfill";
import {
  ALARM_REFRESH,
  MESSAGE_MARK_ENTRY_IDS_AS_READ,
  MESSAGE_TOGGLE_ENTRY_BOOKMARK,
  notifyRefreshEntries,
  refreshActionBehavior,
  refreshEntries,
  request,
  updateBadge,
} from "./common";

/**
 * @typedef {import('./common.js').Entry} Entry
 */

/**
 * Removes multiple entry IDs from the Miniflux instance, update local cache,
 * notify refresh, and update badge.
 *
 * @param {Number[]} entryIds
 * @returns {Entry[]}
 * @throws {Error}
 */
const markEntriesAsRead = async (entryIds) => {
  const data = await browser.storage.local.get("entries");
  const previousEntries = data.entries || [];

  const updatedEntries = previousEntries.filter(
    (e) => !entryIds.includes(e.id),
  );

  // Optimistic UI.
  await browser.storage.local.set({ entries: updatedEntries });
  await Promise.all([notifyRefreshEntries(), updateBadge()]);

  try {
    // Mark an entry as read in the Miniflux instance.
    await request(`/v1/entries`, {
      method: "PUT",
      body: JSON.stringify({ entry_ids: entryIds, status: "read" }),
    });
    return updatedEntries;
  } catch (error) {
    console.error("Error while marking the entry as read, reverting:", error);
    await browser.storage.local.set({ entries: previousEntries });
    await Promise.all([notifyRefreshEntries(), updateBadge()]);
    throw error;
  }
};

/**
 * Change entry bookmark status in an optimistic way.
 *
 * @param {number} entryId
 */
const toggleBookmark = async (entryId) => {
  const data = await browser.storage.local.get("entries");
  const previousEntries = data.entries || [];

  const entryIndex = previousEntries.findIndex((e) => e.id === entryId);
  if (entryIndex === -1) return;

  const isStarred = previousEntries[entryIndex].starred;

  const updatedEntries = [...previousEntries];
  updatedEntries[entryIndex] = {
    ...updatedEntries[entryIndex],
    starred: !isStarred,
  };
  await browser.storage.local.set({ entries: updatedEntries });

  await notifyRefreshEntries();

  try {
    await request(`/v1/entries/${entryId}/bookmark`, { method: "PUT" });
    return updatedEntries;
  } catch (error) {
    console.error("Error bookmarking the entry, reverting:", error);

    await browser.storage.local.set({ entries: previousEntries });
    await notifyRefreshEntries();
    throw error;
  }
};

const handleStartup = async () => {
  console.log("Extension started.");
  await Promise.all([refreshActionBehavior(), refreshEntries()]);
};
const handleInstalled = handleStartup;
const handleMessage = (message) => {
  if (message.action === MESSAGE_MARK_ENTRY_IDS_AS_READ) {
    return markEntriesAsRead(message.entryIds);
  } else if (message.action === MESSAGE_TOGGLE_ENTRY_BOOKMARK) {
    return toggleBookmark(message.entryId);
  } else {
    return false;
  }
};

browser.runtime.onStartup.addListener(handleStartup);
browser.runtime.onInstalled.addListener(handleInstalled);
browser.runtime.onMessage.addListener(handleMessage);

// Create browser alarm to wake up the background service.
browser.alarms.onAlarm.addListener((alarmInfo) => {
  if (alarmInfo.name === ALARM_REFRESH) {
    return refreshEntries();
  }
});
