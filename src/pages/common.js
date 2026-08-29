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
 * @property {number} id Icon identifier.
 * @property {string} data Data URL **without** the `data:` scheme prefix,
 *   e.g. "image/png;base64,iVBORw0KGgoAAA....". Miniflux's `Icon.DataURL()`
 *   returns `"<mime_type>;base64,<payload>"`, so callers must prepend
 *   `data:` themselves when using it in an `<img src>`.
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
export const DEFAULT_MAX_ENTRIES = 100;
// Max value accepted by the Miniflux API for the `limit` query parameter.
export const MAX_ENTRIES_LIMIT = 500;

/**
 * Resolve a stored max entries value to a number accepted by the Miniflux
 * API, falling back to the default for invalid values.
 * @param {unknown} maxEntries
 * @returns {number}
 */
export const resolveMaxEntries = (maxEntries) => {
  const requested = Number(maxEntries);
  return Number.isFinite(requested) && requested >= 1
    ? Math.min(Math.floor(requested), MAX_ENTRIES_LIMIT)
    : DEFAULT_MAX_ENTRIES;
};
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
export const MESSAGE_TOGGLE_ENTRY_BOOKMARK = "toggle_bookmark";

// Custom error types
export class InvalidUrlOrTokenError extends Error {
  constructor(message = "You must configure your Miniflux URL and token") {
    super(message);
    this.name = "InvalidUrlOrTokenError";
  }
}

export class MinifluxConnectionError extends Error {
  constructor(message, { cause } = {}) {
    super(message);
    this.name = "MinifluxConnectionError";
    this.cause = cause;
  }
}

/**
 * Get popup style from URL parameters
 * @returns {string} The style ('popup' or 'window')
 */
export const getPopupStyle = () => {
  if (typeof window === "undefined") {
    return "popup";
  }
  return new URLSearchParams(window.location.search).get("style") || "popup";
};

/**
 * Close window if in popup mode
 */
export const closeIfPopup = () => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (getPopupStyle() === "popup") {
      window.close();
    }
  } catch {
    // window.location may be unavailable in certain environments
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
export const validateCredentials = (url, token) => {
  if (!url || !token) {
    throw new InvalidUrlOrTokenError();
  }
};

/**
 * Make a Miniflux API request
 *
 * The URL and Token will be fetched from browser.storage.local if not supplied.
 *
 * @param {string} path - API endpoint path (e.g., "/v1/me/"), resolved against the Miniflux URL (any subpath in the URL is preserved)
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

  let requestUrl;
  try {
    requestUrl = new URL(
      url.replace(/\/+$/, "") + (path.startsWith("/") ? path : `/${path}`),
    );
  } catch (error) {
    throw new MinifluxConnectionError(`Invalid Miniflux URL: ${url}`, {
      cause: error,
    });
  }
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
export const filterVisibleEntries = (entries) => {
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
    throw new Error("Failed to update badge", { cause: error });
  }
}

/**
 * Update badge for connection error
 * @returns {Promise<void[]>}
 */
export async function updateBadgeConnectionError() {
  const { url = "" } = await browser.storage.local.get("url");

  await browser.action.setTitle({
    title: chrome.i18n.getMessage("connectionMinifluxError", url),
  });
  await browser.action.setBadgeText({ text: "⚡" });
  // Use the regular badge colors (stored or defaults) so the glyph stays
  // visible on both light and dark toolbars.
  await updateBadgeColor();
}

/**
 * Check if error is ignorable
 * @param {Error} error - The error to check
 * @returns {boolean}
 */
const isIgnorableError = (error) => {
  const message = error?.message ?? "";
  return (
    message.includes("Could not establish connection") ||
    message.includes("No matching handler found")
  );
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
export function groupEntriesByFeed(entries) {
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
    console.warn("The notification option is on, but permission is missing.");
    return;
  }

  // Build notification
  let extensionName = chrome.i18n.getMessage("extensionName");
  let options = {
    iconUrl: chrome.runtime.getURL("/pages/assets/icon-dark-196x196.png"),
    title: extensionName,
    message: "",
  };

  if (newEntries.length === 1) {
    const entry = newEntries[0];
    options.type = "basic";
    options.title = entry.feed.title || extensionName;
    // A basic notification requires a non-empty message; fall back to the
    // feed title (or the extension name) for entries without a title.
    options.message = entry.title || entry.feed?.title || extensionName;
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
  let fetchedEntries;

  const { maxEntries = DEFAULT_MAX_ENTRIES } =
    await browser.storage.local.get("maxEntries");
  const limit = resolveMaxEntries(maxEntries);

  try {
    const response = await request(
      `/v1/entries?status=unread&order=published_at&direction=desc&limit=${limit}`,
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new MinifluxConnectionError(
        `Failed to fetch entries: ${errorText}`,
        { cause: new Error(errorText) },
      );
    }

    const data = await response.json();
    fetchedEntries = data.entries || [];
  } catch (error) {
    if (error instanceof InvalidUrlOrTokenError) {
      throw error;
    }
    if (error instanceof MinifluxConnectionError) {
      await updateBadgeConnectionError();
      throw error;
    }
    console.error("Unexpected error during refresh:", error);
    throw error;
  }

  const { entries: cachedEntries = [] } =
    await browser.storage.local.get("entries");

  if (fetchedEntries.length > 0) {
    const cachedIds = new Set(cachedEntries.map((e) => e.id));
    const newArrivals = fetchedEntries.filter((e) => !cachedIds.has(e.id));

    if (newArrivals.length > 0) {
      sendNotification(newArrivals).catch((err) =>
        console.error("Notification error:", err),
      );
    }
  }

  await browser.storage.local.set({ entries: fetchedEntries });

  try {
    await Promise.all([updateBadge(), notifyRefreshEntries(), refreshAlarm()]);
  } catch (error) {
    console.error("Failed to update UI after refresh:", error);
  }

  console.log(`${fetchedEntries.length} entries fetched.`);
  return fetchedEntries;
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
  browser.action.onClicked.removeListener(actionWindow);
  browser.action.onClicked.removeListener(actionSidePanel);
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

  const period = Number(periodInMinutes);
  // The alarms API rejects periods below 1 minute, so treat sub-minute
  // values as invalid and fall back to the default.
  const safePeriod =
    Number.isFinite(period) && period >= 1 ? period : DEFAULT_PERIOD_REFRESH;

  await browser.alarms.create(ALARM_REFRESH, {
    periodInMinutes: safePeriod,
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
