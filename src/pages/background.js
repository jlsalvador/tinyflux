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
import { deleteEntries, getEntries, updateEntry, upsertEntries } from "./db.js";

/**
 * @typedef {import('./common.js').Entry} Entry
 */

// ============================================================================
// Entry Actions
// ============================================================================

// Entry actions read-modify-write the IndexedDB entries store through db.js.
// Each operation runs inside a single atomic IDB transaction, so the browser's
// own per-transaction serialization replaces the hand-rolled promise queue and
// fingerprint retry that used to guard the storage.local cache: two overlapping
// mutations (e.g. a fast "mark as read" and a scheduled refresh) can no longer
// clobber each other's writes.

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

  // Optimistic update: read the current entries, keep the ones being marked
  // read so they can be restored if the API call fails, and atomically delete
  // them from the store.
  const allEntries = await getEntries();
  const removedIds = new Set(entryIds);
  const removedEntries = allEntries.filter((entry) => removedIds.has(entry.id));
  const remainingEntries = allEntries.filter(
    (entry) => !removedIds.has(entry.id),
  );

  if (removedEntries.length > 0) {
    await deleteEntries(removedEntries.map((entry) => entry.id));
  }
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

    return remainingEntries;
  } catch (error) {
    // Roll back by re-inserting the removed entries. upsertEntries only writes
    // ids that are absent, so a concurrent refresh that already restored some
    // of them is not duplicated.
    if (removedEntries.length > 0) {
      try {
        await upsertEntries(removedEntries);
      } catch (rollbackError) {
        console.error("Failed to revert the entries cache:", rollbackError);
      }
    }
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
  // Pre-toggle copy of the entry, captured by the updater so it can be
  // restored verbatim if the API call fails.
  let previousEntry = null;

  // Atomically read-modify-write the single entry, flipping its starred flag.
  await updateEntry(entryId, (entry) => {
    previousEntry = entry;
    return { ...entry, starred: !entry.starred };
  });

  if (!previousEntry) {
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

    return await getEntries();
  } catch (error) {
    // Roll back by restoring the pre-toggle entry atomically.
    if (previousEntry) {
      try {
        await updateEntry(entryId, () => previousEntry);
      } catch (rollbackError) {
        console.error("Failed to revert the bookmark cache:", rollbackError);
      }
    }
    await notifyRefreshEntries();
    throw new Error("Failed to toggle bookmark, reverting", { cause: error });
  }
};

// ============================================================================
// Lifecycle
// ============================================================================

/**
 * Remove legacy entries and icon records that older versions kept in
 * storage.local. The migration to IndexedDB does not copy them over (they are
 * re-downloaded on the next refresh), so we just drop the now-unused keys.
 * Idempotent: a no-op once the keys are gone.
 * @returns {Promise<void>}
 */
const cleanupLegacyStorage = async () => {
  // Matches the legacy per-icon cache keys ("icon123") older versions wrote
  // to storage.local before icons moved to IndexedDB.
  const legacyIconKeyPattern = /^icon\d+$/;
  const keys = await browser.storage.local.getKeys();
  const staleKeys = keys.filter(
    (key) => key === "entries" || legacyIconKeyPattern.test(key),
  );
  if (staleKeys.length > 0) {
    await browser.storage.local.remove(staleKeys);
  }
};

/**
 * Initialize extension on startup or installation.
 */
export const handleStartup = async () => {
  console.log("Extension started.");
  cleanupLegacyStorage().catch((error) => {
    console.error("Failed to clean up legacy storage:", error);
  });
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
