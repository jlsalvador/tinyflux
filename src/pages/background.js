/* global console */

"use strict";

import browser from "webextension-polyfill";
import {
  ALARM_REFRESH,
  InvalidUrlOrTokenError,
  MESSAGE_MARK_ENTRY_IDS_AS_READ,
  MESSAGE_TOGGLE_ENTRY_BOOKMARK,
  MinifluxConnectionError,
  notifyRefreshEntries,
  openSettings,
  refreshActionBehavior,
  refreshEntries,
  request,
  updateBadge,
} from "./common.js";

/**
 * @typedef {import('./common.js').Entry} Entry
 */

// ============================================================================
// Entry Actions
// ============================================================================

/**
 * Mark entries as read via Miniflux API with optimistic UI update.
 * Reverts local cache on API failure.
 * @param {number[]} entryIds
 * @returns {Promise<Entry[]>}
 * @throws {Error}
 */
export const markEntriesAsRead = async (entryIds) => {
  const { entries: previousEntries = [] } =
    await browser.storage.local.get("entries");

  const updatedEntries = previousEntries.filter(
    (entry) => !entryIds.includes(entry.id),
  );

  // Optimistic UI update
  await browser.storage.local.set({ entries: updatedEntries });
  await Promise.all([notifyRefreshEntries(), updateBadge()]);

  try {
    const response = await request(`/v1/entries`, {
      method: "PUT",
      body: JSON.stringify({ entry_ids: entryIds, status: "read" }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new MinifluxConnectionError(
        `Failed to mark entries as read: ${errorText}`,
        { cause: new Error(errorText) },
      );
    }

    return updatedEntries;
  } catch (error) {
    await browser.storage.local.set({ entries: previousEntries });
    await Promise.all([notifyRefreshEntries(), updateBadge()]);
    throw new Error("Failed to mark entries as read, reverting", {
      cause: error,
    });
  }
};

/**
 * Toggle entry bookmark status with optimistic UI update.
 * Reverts local cache on API failure.
 * @param {number} entryId
 * @returns {Promise<Entry[]>}
 */
export const toggleBookmark = async (entryId) => {
  const { entries: previousEntries = [] } =
    await browser.storage.local.get("entries");

  const entryIndex = previousEntries.findIndex((entry) => entry.id === entryId);
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
    const response = await request(`/v1/entries/${entryId}/bookmark`, {
      method: "PUT",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new MinifluxConnectionError(
        `Failed to toggle bookmark: ${errorText}`,
        { cause: new Error(errorText) },
      );
    }

    return updatedEntries;
  } catch (error) {
    await browser.storage.local.set({ entries: previousEntries });
    await notifyRefreshEntries();
    throw new Error("Failed to toggle bookmark, reverting", { cause: error });
  }
};

// ============================================================================
// Lifecycle
// ============================================================================

/**
 * Initialize extension on startup or installation.
 */
export const handleStartup = async () => {
  console.log("Extension started.");
  try {
    await Promise.all([refreshActionBehavior(), refreshEntries()]);
  } catch (error) {
    if (error instanceof InvalidUrlOrTokenError) {
      await openSettings();
    } else {
      throw error;
    }
  }
};

/**
 * Route incoming messages to the appropriate handler.
 * @param {object} message
 * @returns {Promise<Entry[]|false>}
 */
export const handleMessage = async (message) => {
  switch (message.action) {
    case MESSAGE_MARK_ENTRY_IDS_AS_READ:
      return markEntriesAsRead(message.entryIds).catch((error) => {
        console.error(error);
      });
    case MESSAGE_TOGGLE_ENTRY_BOOKMARK:
      return toggleBookmark(message.entryId).catch((error) => {
        console.error(error);
      });
    default:
      return false;
  }
};

// ============================================================================
// Event Listeners
// ============================================================================

browser.runtime.onStartup.addListener(handleStartup);
browser.runtime.onInstalled.addListener(handleStartup);
browser.runtime.onMessage.addListener(handleMessage);

browser.alarms.onAlarm.addListener((alarmInfo) => {
  if (alarmInfo.name === ALARM_REFRESH) {
    return refreshEntries();
  }
});
