/* global document, window, URLSearchParams, fetch, Request, URL, Headers, console, chrome */

"use strict";

import browser from "webextension-polyfill";

/**
 * @typedef {Object} Enclosure
 * @property {number} id
 * @property {number} user_id
 * @property {number} entry_id
 * @property {string} url
 * @property {string} mime_type
 * @property {number} size
 * @property {number} media_progression
 */

/**
 * @typedef {Object} Category
 * @property {number} id
 * @property {string} title
 * @property {number} user_id
 * @property {boolean} hide_globally
 */

/**
 * @typedef {Object} FeedIcon
 * @property {number} feed_id
 * @property {number} icon_id
 */

/**
 * @typedef {Object} Feed
 * @property {number} id
 * @property {number} user_id
 * @property {string} feed_url
 * @property {string} site_url
 * @property {string} title
 * @property {string} description
 * @property {string} checked_at
 * @property {string} next_check_at
 * @property {string} etag_header
 * @property {string} last_modified_header
 * @property {string} parsing_error_message
 * @property {number} parsing_error_count
 * @property {string} scraper_rules
 * @property {string} rewrite_rules
 * @property {boolean} crawler
 * @property {string} blocklist_rules
 * @property {string} keeplist_rules
 * @property {string} urlrewrite_rules
 * @property {string} user_agent
 * @property {string} cookie
 * @property {string} username
 * @property {string} password
 * @property {boolean} disabled
 * @property {boolean} no_media_player
 * @property {boolean} ignore_http_cache
 * @property {boolean} allow_self_signed_certificates
 * @property {boolean} fetch_via_proxy
 * @property {boolean} hide_globally
 * @property {string} apprise_service_urls
 * @property {boolean} disable_http2
 * @property {Category} category
 * @property {FeedIcon} icon
 */

/**
 * @typedef {Object} Entry
 * @property {number} id
 * @property {number} user_id
 * @property {number} feed_id
 * @property {string} status
 * @property {string} hash
 * @property {string} title
 * @property {string} url
 * @property {string} comments_url
 * @property {string} published_at
 * @property {string} created_at
 * @property {string} changed_at
 * @property {string} content
 * @property {string} author
 * @property {string} share_code
 * @property {boolean} starred
 * @property {number} reading_time
 * @property {Enclosure[]} enclosures
 * @property {Feed} feed
 * @property {string[]} tags
 */

/**
 * @typedef {Object} Icon
 * @property {number} id 262
 * @property {string} data "image/png;base64,iVBORw0KGgoAAA...."
 * @property {string} mime_type "image/png"
 */

/**
 * @typedef {object} User
 * @property {number} id
 * @property {string} username
 * @property {boolean} is_admin
 * @property {string} theme
 * @property {string} language
 * @property {string} timezone
 * @property {string} entry_sorting_direction
 * @property {string} entry_sorting_order
 * @property {string} stylesheet
 * @property {string} google_id
 * @property {string} openid_connect_id
 * @property {number} entries_per_page
 * @property {boolean} keyboard_shortcuts
 * @property {boolean} show_reading_time
 * @property {boolean} entry_swipe
 * @property {string} gesture_nav
 * @property {string} last_login_at
 * @property {string} display_mode
 * @property {number} default_reading_speed
 * @property {number} cjk_reading_speed
 * @property {string} default_home_page
 * @property {string} categories_sorting_order
 * @property {boolean} mark_read_on_view
 * @property {number} media_playback_rate
 * @property {string} block_filter_entry_rules
 * @property {string} keep_filter_entry_rules
 */

// Default configuration values
export const DEFAULT_URL = "";
export const DEFAULT_TOKEN = "";
export const DEFAULT_PERIOD_REFRESH = 15;
export const DEFAULT_EXTENSION_CLICK_BEHAVIOR = "popup";
export const DEFAULT_MARK_ENTRY_AS_READ_WHEN_OPENED_AS_TAB = false;
export const DEFAULT_THEME = "light";
export const DEFAULT_BADGE_BACKGROUND_COLOR = "#000000";
export const DEFAULT_BADGE_TEXT_COLOR = "#ffffff";
export const DEFAULT_SHOW_NOTIFICATIONS = false;

// Alarm identifiers
export const ALARM_REFRESH = "ALARM_REFRESH";

// Message action types
export const MESSAGE_REFRESH_THEME = "refresh_theme";
export const MESSAGE_REFRESH_VIEW_ENTRIES = "refresh_view_entries";
export const MESSAGE_MARK_ENTRY_IDS_AS_READ = "mark_entry_ids_as_read";

// Custom error types
export class InvalidUrlOrTokenError extends Error {
  constructor(message = "You must configure your Miniflux URL and Token") {
    super(message);
    this.name = "InvalidUrlOrTokenError";
  }
}

export class ReceivingEndDoesNotExistError extends Error {
  constructor(
    message = "Could not establish connection. Receiving end does not exist.",
  ) {
    super(message);
    this.name = "ReceivingEndDoesNotExistError";
  }
}

// Legacy error exports for backwards compatibility
export const ErrorInvalidUrlOrToken = new InvalidUrlOrTokenError();
export const ErrorReceivingEndDoesNotExist =
  new ReceivingEndDoesNotExistError();

/**
 * Get popup style from URL parameters
 * @returns {string} The style ('popup' or 'window')
 */
const getPopupStyle = () => {
  if (typeof window === "undefined") {
    return "popup";
  }
  return new URLSearchParams(window.location.search).get("style") || "popup";
};

/**
 * Close window if in popup mode
 */
const closeIfPopup = () => {
  if (typeof window === "undefined") {
    return;
  }
  if (getPopupStyle() === "popup") {
    window.close();
  }
};

/**
 * Open the extension settings page
 * @returns {Promise<void>}
 */
export async function openSettings() {
  await browser.runtime.openOptionsPage();
  closeIfPopup();
}

/**
 * Validate URL and Token from storage
 * @param {string} url - The Miniflux URL
 * @param {string} token - The API token
 * @throws {InvalidUrlOrTokenError}
 */
const validateCredentials = (url, token) => {
  if (!url || !token) {
    throw new InvalidUrlOrTokenError();
  }
};

/**
 * Make a Miniflux API request
 *
 * The URL and Token will be fetched from browser.storage.local if not supplied.
 *
 * @param {string} path - API endpoint path (e.g., "/v1/me/")
 * @param {Object} [options] - Request options
 * @param {string} [options.url] - Miniflux URL (fetched from storage if not provided)
 * @param {string} [options.token] - API token (fetched from storage if not provided)
 * @param {string} [options.method="GET"] - HTTP method
 * @param {any} [options.body] - Request body
 * @param {string} [options.contentType="application/json"] - Content-Type header
 * @returns {Promise<Response>}
 * @throws {InvalidUrlOrTokenError|TypeError}
 */
export async function request(path, options = {}) {
  const {
    url: providedUrl = "",
    token: providedToken = "",
    method = "GET",
    body = undefined,
    contentType = "application/json",
  } = options;

  let url = providedUrl;
  let token = providedToken;

  // Fetch credentials from storage if not provided
  if (!url || !token) {
    const stored = await browser.storage.local.get(["url", "token"]);
    url = url || stored.url || "";
    token = token || stored.token || "";
  }

  validateCredentials(url, token);

  const headers = new Headers({
    "X-Auth-Token": token,
  });

  if (body !== undefined) {
    headers.set("Content-Type", contentType);
  }

  const requestUrl = new URL(path, url);
  const requestOptions = {
    method,
    headers,
    body,
  };

  return fetch(new Request(requestUrl, requestOptions));
}

/**
 * Update badge colors from storage settings
 * @returns {Promise<void[]>}
 */
export async function updateBadgeColor() {
  const { badgeBackgroundColor, badgeTextColor } =
    await browser.storage.local.get(["badgeBackgroundColor", "badgeTextColor"]);

  const backgroundColor =
    badgeBackgroundColor || DEFAULT_BADGE_BACKGROUND_COLOR;
  const textColor = badgeTextColor || DEFAULT_BADGE_TEXT_COLOR;

  return Promise.all([
    browser.action.setBadgeBackgroundColor({ color: backgroundColor }),
    browser.action.setBadgeTextColor({ color: textColor }),
  ]);
}

/**
 * Filter visible entries
 * @param {Entry[]} entries - Array of entries to filter
 * @returns {Entry[]} Filtered entries
 */
const filterVisibleEntries = (entries) => {
  return entries
    .filter((entry) => entry?.feed && !entry.feed.hide_globally)
    .filter(
      (entry) => entry?.feed?.category && !entry.feed.category.hide_globally,
    );
};

/**
 * Update browser extension badge with number of unread entries
 * @returns {Promise<void[]>}
 */
export async function updateBadge() {
  try {
    const { entries = [] } = await browser.storage.local.get("entries");
    const visibleEntries = filterVisibleEntries(entries);
    const badgeText =
      visibleEntries.length === 0 ? "" : String(visibleEntries.length);

    return Promise.all([
      browser.action.setTitle({
        title: chrome.i18n.getMessage("extensionName"),
      }),
      browser.action.setBadgeText({ text: badgeText }),
      updateBadgeColor(),
    ]);
  } catch (error) {
    console.error("Failed to update badge:", error);
    throw error;
  }
}

/**
 * Update badge for connection error
 * @returns {Promise<void[]>}
 */
export async function updateBadgeConnectionError() {
  const { url = "" } = await browser.storage.local.get("url");

  return Promise.all([
    browser.action.setTitle({
      title: chrome.i18n.getMessage("connectionMinifluxError", url),
    }),
    browser.action.setBadgeText({ text: "⚡" }),
    browser.action.setBadgeTextColor({ color: "white" }),
    browser.action.setBadgeBackgroundColor({ color: "transparent" }),
  ]);
}

/**
 * Check if error is ignorable
 * @param {Error} error - The error to check
 * @returns {boolean}
 */
const isIgnorableError = (error) => {
  return error?.message === ErrorReceivingEndDoesNotExist.message;
};

/**
 * Notify popup to refresh entries
 * @returns {Promise<void>}
 */
export const notifyRefreshEntries = async () => {
  try {
    await browser.runtime.sendMessage({
      action: MESSAGE_REFRESH_VIEW_ENTRIES,
    });
  } catch (error) {
    if (!isIgnorableError(error)) {
      throw error;
    }
  }
};

/**
 * Notify popup to refresh theme
 * @returns {Promise<void>}
 */
export async function notifyRefreshTheme() {
  try {
    await browser.runtime.sendMessage({
      action: MESSAGE_REFRESH_THEME,
    });
  } catch (error) {
    if (!isIgnorableError(error)) {
      throw error;
    }
  }
}

/**
 * Group entries by feed title
 * @param {Array<Entry>} entries - Array of entry objects
 * @returns {Object} - Object with feed title as key and array of entry titles as value
 */
function groupEntriesByFeed(entries) {
  return entries.reduce((groups, entry) => {
    const feedTitle =
      entry.feed.title || chrome.i18n.getMessage("extensionName");

    if (!groups[feedTitle]) {
      groups[feedTitle] = [];
    }

    groups[feedTitle].push(entry.title);
    return groups;
  }, {});
}

/**
 * Sends a browser notification if permission is granted
 * @param {Entry[]} newEntries
 */
async function sendNotification(newEntries) {
  // Check if notifications is enabled
  const { showNotifications = DEFAULT_SHOW_NOTIFICATIONS } =
    await browser.storage.local.get("showNotifications");

  if (!showNotifications || newEntries.length === 0) {
    return;
  }

  // Check browser permissions for notifications
  const hasPermission = await browser.permissions.contains({
    permissions: ["notifications"],
  });

  if (!hasPermission) {
    console.warn("Notification option is on, but permission is missing.");
    return;
  }

  // Build notification
  let extensionName = chrome.i18n.getMessage("extensionName");
  let options = {
    iconUrl: "assets/icon-dark-196x196.png",
    title: extensionName,
    message: "",
  };

  if (newEntries.length === 1) {
    const entry = newEntries[0];
    options.type = "basic";
    options.title = entry.feed.title || extensionName;
    options.message = entry.title;
  } else {
    options.type = "list";
    options.message = chrome.i18n.getMessage(
      "notificationNewEntriesAvailable",
      String(newEntries.length),
    );

    const groupedEntries = groupEntriesByFeed(newEntries);
    options.items = Object.entries(groupedEntries).map(
      ([feedTitle, titles]) => ({
        title: feedTitle,
        message: titles.join("\n"),
      }),
    );
  }

  // Send notification
  await chrome.notifications.create("tinyflux-update", options);
}

/**
 * Fetch entries from Miniflux, save to storage, and update UI
 * @returns {Promise<Entry[]>}
 * @throws {Error}
 */
export async function refreshEntries() {
  try {
    const response = await request(
      "/v1/entries?status=unread&order=published_at&direction=desc",
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch entries: ${errorText}`);
    }

    const data = await response.json();
    const fetchedEntries = data.entries || [];
    const { entries: cachedEntries = [] } =
      await browser.storage.local.get("entries");

    if (fetchedEntries.length > 0) {
      const cachedIds = new Set(cachedEntries.map((e) => e.id));
      // Filter out already cached entries to avoid duplicates
      const newArrivals = fetchedEntries.filter((e) => !cachedIds.has(e.id));

      if (newArrivals.length > 0) {
        // Do not await here to not block the saving process
        sendNotification(newArrivals).catch((err) =>
          console.error("Notif error:", err),
        );
      }
    }

    await browser.storage.local.set({ entries: fetchedEntries });

    await Promise.all([updateBadge(), notifyRefreshEntries(), refreshAlarm()]);

    console.log(`${fetchedEntries.length} entries fetched.`);
    return fetchedEntries;
  } catch (error) {
    if (
      error instanceof InvalidUrlOrTokenError ||
      error === ErrorInvalidUrlOrToken
    ) {
      await openSettings();
    } else {
      await updateBadgeConnectionError();
    }
    throw error;
  }
}

/**
 * Open extension in window
 * @returns {Promise<browser.windows.Window>}
 */
export async function actionWindow() {
  return browser.windows.create({
    url: "/pages/popup.html?style=window",
    type: "popup",
    width: 360,
    height: 600,
  });
}

/**
 * Toggle side panel
 * @returns {Promise<void>}
 */
export async function actionSidePanel() {
  return browser.sidebarAction.toggle();
}

/**
 * Remove action listeners
 */
const removeActionListeners = () => {
  if (browser.action.onClicked.hasListener(actionWindow)) {
    browser.action.onClicked.removeListener(actionWindow);
  }
  if (browser.action.onClicked.hasListener(actionSidePanel)) {
    browser.action.onClicked.removeListener(actionSidePanel);
  }
};

/**
 * Refresh action behavior
 * @returns {Promise<void>}
 */
export async function refreshActionBehavior() {
  await browser.action.setPopup({ popup: "" });
  removeActionListeners();

  if (!browser.sidebarAction && chrome?.sidePanel) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  }

  const { extensionClickBehavior = DEFAULT_EXTENSION_CLICK_BEHAVIOR } =
    await browser.storage.local.get("extensionClickBehavior");

  switch (extensionClickBehavior) {
    case "window":
      browser.action.onClicked.addListener(actionWindow);
      break;

    case "sidepanel":
      if (!browser.sidebarAction && chrome?.sidePanel) {
        chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      } else if (browser.sidebarAction) {
        browser.action.onClicked.addListener(actionSidePanel);
      }
      break;

    case "popup":
    default:
      await browser.action.setPopup({
        popup: "/pages/popup.html?style=popup",
      });
      break;
  }
}

/**
 * Refresh alarm
 * @returns {Promise<void>}
 */
export async function refreshAlarm() {
  const { periodInMinutes = DEFAULT_PERIOD_REFRESH } =
    await browser.storage.local.get("periodInMinutes");

  const period = Number(periodInMinutes) || DEFAULT_PERIOD_REFRESH;

  await browser.alarms.create(ALARM_REFRESH, {
    periodInMinutes: period,
  });
}

/**
 * Apply theme to document
 * @returns {Promise<void>}
 */
export async function refreshTheme() {
  if (typeof document === "undefined") {
    return;
  }

  const { theme = DEFAULT_THEME } = await browser.storage.local.get("theme");
  document.documentElement.setAttribute("data-theme", theme);
}
