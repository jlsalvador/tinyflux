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
 * Build a fingerprint of an entry list from the fields the entry actions
 * depend on (id and starred), to detect concurrent modifications.
 * @param {Entry[]} entries
 * @returns {string}
 */
const entriesFingerprint = (entries) =>
  entries
    .map((entry) => `${entry.id}:${entry.starred ? 1 : 0}`)
    .sort()
    .join(",");

/**
 * Apply a read-modify-write to the cached entries, retrying when a
 * concurrent operation (e.g. a refresh coming from the popup) modifies the
 * cache between the read and the write. The mutator is always applied to the
 * latest cached state. A mutator returning `null` is a no-op: nothing is
 * written and `null` is returned.
 * @param {(entries: Entry[]) => Entry[]|null} mutator
 * @param {number} [maxAttempts=3]
 * @returns {Promise<Entry[]|null>} The entries stored after the update, or
 *   `null` when the mutator was a no-op.
 * @throws {Error}
 */
const updateCachedEntries = async (mutator, maxAttempts = 3) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { entries: previousEntries = [] } =
      await browser.storage.local.get("entries");
    const updatedEntries = mutator(previousEntries);
    if (updatedEntries === null) {
      return null;
    }
    // Re-read to detect concurrent writes between the read and the write.
    const { entries: latestEntries = [] } =
      await browser.storage.local.get("entries");
    if (
      entriesFingerprint(latestEntries) === entriesFingerprint(previousEntries)
    ) {
      await browser.storage.local.set({ entries: updatedEntries });
      return updatedEntries;
    }
  }
  throw new Error(
    "Failed to update cached entries after concurrent modifications",
  );
};

/**
 * Mark entries as read via Miniflux API with optimistic UI update.
 * Reverts local cache on API failure.
 * @param {number[]} entryIds
 * @returns {Promise<Entry[]|undefined>}
 * @throws {Error}
 */
export const markEntriesAsRead = async (entryIds) => {
  if (!Array.isArray(entryIds) || entryIds.length === 0) {
    return;
  }

  const { entries: previousEntries = [] } =
    await browser.storage.local.get("entries");

  // Optimistic UI update
  const updatedEntries = await updateCachedEntries((entries) =>
    entries.filter((entry) => !entryIds.includes(entry.id)),
  );
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
 * @returns {Promise<Entry[]|undefined>}
 */
export const toggleBookmark = async (entryId) => {
  const { entries: previousEntries = [] } =
    await browser.storage.local.get("entries");

  const updatedEntries = await updateCachedEntries((entries) => {
    const entryIndex = entries.findIndex((entry) => entry.id === entryId);
    if (entryIndex === -1) {
      return null;
    }
    const next = [...entries];
    next[entryIndex] = {
      ...next[entryIndex],
      starred: !next[entryIndex].starred,
    };
    return next;
  });

  if (updatedEntries === null) {
    return;
  }

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
      // A startup refresh failure is usually transient (e.g. the network is
      // not up yet). The badge already reflects the error and the scheduled
      // alarm retries later, so log it instead of leaving an unhandled
      // rejection in the service worker.
      console.error("Startup refresh failed:", error);
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
      if (!Array.isArray(message.entryIds)) {
        return false;
      }
      return markEntriesAsRead(message.entryIds);
    case MESSAGE_TOGGLE_ENTRY_BOOKMARK:
      if (typeof message.entryId !== "number") {
        return false;
      }
      return toggleBookmark(message.entryId);
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
    refreshEntries().catch((error) => {
      console.error("Scheduled refresh failed:", error);
    });
  }
});
