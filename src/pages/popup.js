/* global document, window, console, chrome, setTimeout, clearTimeout */

"use strict";

import "./localize.js";
import {
  createSvg,
  svg_path_calendar,
  svg_path_clock,
  svg_path_eye,
  svg_path_question_mark,
  svg_path_star_empty,
  svg_path_star_filled,
  svg_path_toggle_close,
  svg_path_toggle_open,
} from "./icons.js";
import browser from "webextension-polyfill";
import { TimeAgo, Style } from "./timeago.js";
import DOMPurify from "dompurify";
import {
  DEFAULT_MAX_ENTRIES,
  DEFAULT_MARK_ENTRY_AS_READ_WHEN_OPENED_AS_TAB,
  ICON_CACHE_KEY_PATTERN,
  ICON_CACHE_KEY_PREFIX,
  MESSAGE_MARK_ENTRY_IDS_AS_READ,
  MESSAGE_REFRESH_THEME,
  MESSAGE_REFRESH_VIEW_ENTRIES,
  MESSAGE_TOGGLE_ENTRY_BOOKMARK,
  InvalidUrlOrTokenError,
  closeIfPopup,
  filterVisibleEntries,
  getPopupStyle,
  notifyRefreshTheme,
  refreshEntries,
  refreshTheme,
  request,
  resolveMaxEntries,
  openSettings,
} from "./common.js";

/**
 * @typedef {import('./common.js').Entry} Entry
 * @typedef {import('./common.js').Icon} Icon
 */

// ============================================================================
// Constants
// ============================================================================

const MARK_ENTRIES_AS_READ_TIMEOUT_MS = 5000;
const ICON_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ============================================================================
// State Management
// ============================================================================

const state = {
  iconCache: new Map(),
  iconPromises: new Map(),
  confirmMarkAllEntriesTimeout: null,
  dropdownOpen: false,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Open a URL in a new active tab and close the popup if in popup mode
 * @param {string} url
 * @returns {Promise<browser.tabs.Tab>}
 */
const openLink = async (url) => {
  const tab = await browser.tabs.create({ active: true, url });
  closeIfPopup();

  return tab;
};

// ============================================================================
// Icon Management
// ============================================================================

/**
 * Keep the persisted icon cache bounded: drop the oldest cached icons once
 * the cache exceeds the configured max entries (we never need more cached
 * icons than the number of entries that can be displayed).
 * @returns {Promise<void>}
 */
const pruneIconCache = async () => {
  const { maxEntries = DEFAULT_MAX_ENTRIES } =
    await browser.storage.local.get("maxEntries");
  const maxIcons = resolveMaxEntries(maxEntries);

  // Resolve the icon keys first and only read their values, so the (large)
  // cached entries are never loaded just to prune a few icons.
  const allKeys = await browser.storage.local.getKeys();
  const iconKeys = allKeys.filter((key) => ICON_CACHE_KEY_PATTERN.test(key));
  const overflow = iconKeys.length - maxIcons;
  if (overflow <= 0) {
    return;
  }

  const data = await browser.storage.local.get(iconKeys);
  const iconEntries = iconKeys
    .map((key) => ({ key, fetchedAt: data[key]?.fetchedAt ?? 0 }))
    .sort((a, b) => a.fetchedAt - b.fetchedAt);

  await browser.storage.local.remove(
    iconEntries.slice(0, overflow).map((entry) => entry.key),
  );
};

/**
 * Fetch Icon from cache or API
 * @param {number} iconID
 * @returns {Promise<Icon>}
 */
const getIcon = async (iconID) => {
  // Check memory cache
  if (state.iconCache.has(iconID)) {
    return state.iconCache.get(iconID);
  }

  if (state.iconPromises.has(iconID)) {
    return state.iconPromises.get(iconID);
  }

  const fetchIconPromise = (async () => {
    // Check storage cache
    const cacheKey = `${ICON_CACHE_KEY_PREFIX}${iconID}`;
    const cachedIcon = await browser.storage.local
      .get(cacheKey)
      .then((data) => data[cacheKey]);

    if (
      cachedIcon?.icon &&
      Date.now() - (cachedIcon.fetchedAt || 0) < ICON_CACHE_TTL_MS
    ) {
      state.iconCache.set(iconID, cachedIcon.icon);
      return cachedIcon.icon;
    }

    // Fetch from API
    try {
      const response = await request(`/v1/icons/${iconID}`);

      if (response.status !== 200) {
        console.error("Failed to fetch icon:", response);
        return { data: "" };
      }

      const icon = await response.json();

      // Cache the icon (with a fetch timestamp for TTL and pruning)
      state.iconCache.set(iconID, icon);
      await browser.storage.local.set({
        [cacheKey]: { icon, fetchedAt: Date.now() },
      });
      await pruneIconCache();

      return icon;
    } catch (error) {
      console.error("Error fetching icon:", error);
      return { data: "" };
    }
  })();

  state.iconPromises.set(iconID, fetchIconPromise);

  try {
    return await fetchIconPromise;
  } finally {
    state.iconPromises.delete(iconID);
  }
};

// ============================================================================
// Entry Management
// ============================================================================

/**
 * Update bookmark button visual state
 * @param {HTMLButtonElement} button
 * @param {boolean} isStarred
 */
export const setBookmarkButtonState = (button, isStarred) => {
  button.classList.toggle("starred", isStarred);
  button.replaceChildren(
    createSvg(isStarred ? svg_path_star_filled : svg_path_star_empty),
  );
};

/**
 * Toggle empty state visibility based on entry count
 */
export const updateEmptyState = () => {
  const isEmpty = document.getElementById("isEmpty");
  if (!isEmpty) return;
  const hasEntries = document.querySelectorAll(".entry").length > 0;
  isEmpty.classList.toggle("hidden", hasEntries);
};

/**
 * Sort DOM entries by published date (descending)
 */
export const sortDOMEntries = () => {
  const container = document.querySelector(".entries");
  if (!container) return;

  const entries = Array.from(container.querySelectorAll(".entry"));

  entries
    .sort((a, b) => {
      const timeA = Number(a.dataset.timestamp);
      const timeB = Number(b.dataset.timestamp);
      if (Number.isFinite(timeA) && Number.isFinite(timeB)) {
        return timeB - timeA;
      }
      if (Number.isFinite(timeA)) return 1;
      if (Number.isFinite(timeB)) return -1;
      return 0;
    })
    .forEach((entry) => container.appendChild(entry));
};

/**
 * Create entry content DOM
 * @param {Entry} entry
 * @returns {HTMLDivElement}
 */
export const createEntryContent = (entry) => {
  const content = document.createElement("div");
  content.id = `entryContent-${entry.id}`;
  content.className = "entry-content";
  const cleanFragment = DOMPurify.sanitize(entry.content, {
    RETURN_DOM_FRAGMENT: true,
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling"],
    ALLOWED_URI_REGEXP:
      /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix|magnet):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  });
  content.appendChild(cleanFragment);

  return content;
};

/**
 * Create entry title DOM
 * @param {Entry} entry
 * @returns {Promise<HTMLDivElement>}
 */
const createEntryTitle = async (entry) => {
  const titleContainer = document.createElement("div");
  titleContainer.id = `entryTitle-${entry.id}`;
  titleContainer.className = "entry-title";

  // Title text
  const titleText = document.createElement("div");
  titleText.className = "entry-title-text";
  titleText.textContent = entry.title;
  titleText.addEventListener("click", async () => {
    const shouldMarkAsRead = await browser.storage.local
      .get("markEntryAsReadWhenOpenedAsTab")
      .then((r) =>
        Boolean(
          r.markEntryAsReadWhenOpenedAsTab ??
          DEFAULT_MARK_ENTRY_AS_READ_WHEN_OPENED_AS_TAB,
        ),
      );

    if (shouldMarkAsRead) {
      browser.runtime
        .sendMessage({
          action: MESSAGE_MARK_ENTRY_IDS_AS_READ,
          entryIds: [entry.id],
        })
        .catch((error) =>
          console.error("Failed to mark entry as read:", error),
        );
    }

    await openLink(entry.url);
  });

  // Metadata container
  const meta = document.createElement("div");
  meta.className = "entry-meta";

  // Feed info
  const iconId = entry.feed?.icon?.icon_id;
  const icon = iconId ? await getIcon(iconId) : { data: "" };
  const feedInfo = document.createElement("div");
  feedInfo.className = "entry-feed-info";
  feedInfo.title = entry.feed?.title ?? "";

  if (icon.data) {
    const feedIcon = document.createElement("img");
    feedIcon.className = "feed-icon";
    // Miniflux's Icon.DataURL() returns the payload without the "data:"
    // scheme prefix, so it must be prepended here.
    feedIcon.src = `data:${icon.data}`;
    feedIcon.alt = entry.feed?.title ?? "";
    feedInfo.appendChild(feedIcon);
  }

  const feedTitle = document.createElement("span");
  feedTitle.className = "feed-title";
  feedTitle.textContent = entry.feed?.title ?? "";
  feedInfo.appendChild(feedTitle);

  if (entry.feed?.site_url) {
    feedInfo.addEventListener("click", () => openLink(entry.feed.site_url));
  }

  // Stats
  const stats = document.createElement("div");
  stats.className = "entry-stats";

  // Published date
  const publishedStat = document.createElement("div");
  publishedStat.className = "entry-stat";
  publishedStat.title = new Date(entry.published_at).toLocaleString(undefined, {
    dateStyle: "full",
    timeStyle: "long",
  });
  const publishedTime = document.createElement("span");
  publishedTime.textContent = TimeAgo(entry.published_at, Style.ExtremeNarrow);
  publishedStat.replaceChildren(createSvg(svg_path_calendar), publishedTime);
  stats.appendChild(publishedStat);

  // Reading time
  if (entry.reading_time) {
    const readingTimeStat = document.createElement("div");
    readingTimeStat.className = "entry-stat";
    readingTimeStat.title =
      entry.reading_time === 1
        ? chrome.i18n.getMessage(
            "pagePopupReadingTimeSingular",
            String(entry.reading_time),
          )
        : chrome.i18n.getMessage(
            "pagePopupReadingTimePlural",
            String(entry.reading_time),
          );
    const readingText = document.createElement("span");
    readingText.textContent = chrome.i18n.getMessage(
      "pagePopupReadingTimeShort",
      String(entry.reading_time),
    );
    readingTimeStat.replaceChildren(createSvg(svg_path_clock), readingText);
    stats.appendChild(readingTimeStat);
  }

  // Actions
  const actions = document.createElement("div");
  actions.className = "entry-actions";

  // Bookmark button
  const bookmarkBtn = document.createElement("button");
  bookmarkBtn.className = `entry-action-btn ${entry.starred ? "starred" : ""}`;
  bookmarkBtn.type = "button";
  bookmarkBtn.title = chrome.i18n.getMessage("pagePopupToggleBookmark");
  bookmarkBtn.replaceChildren(
    createSvg(entry.starred ? svg_path_star_filled : svg_path_star_empty),
  );

  bookmarkBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const isStarred = bookmarkBtn.classList.contains("starred");

    // Optimistic UI update
    setBookmarkButtonState(bookmarkBtn, !isStarred);

    try {
      await browser.runtime.sendMessage({
        action: MESSAGE_TOGGLE_ENTRY_BOOKMARK,
        entryId: entry.id,
      });
    } catch (error) {
      console.error("Failed to toggle bookmark:", error);
      setBookmarkButtonState(bookmarkBtn, isStarred);
    }
  });
  actions.appendChild(bookmarkBtn);

  // Mark as read button
  const markReadBtn = document.createElement("button");
  markReadBtn.className = "entry-action-btn";
  markReadBtn.type = "button";
  markReadBtn.title = chrome.i18n.getMessage("pagePopupMarkAsRead");
  markReadBtn.replaceChildren(createSvg(svg_path_eye));

  markReadBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    markReadBtn.disabled = true;
    markReadBtn.querySelector(".icon").classList.add("loading");

    try {
      await browser.runtime.sendMessage({
        action: MESSAGE_MARK_ENTRY_IDS_AS_READ,
        entryIds: [entry.id],
      });
    } catch (error) {
      console.error("Failed to mark as read:", error);
    } finally {
      updateEmptyState();
      markReadBtn.disabled = false;
      markReadBtn.querySelector(".icon").classList.remove("loading");
    }
  });
  actions.appendChild(markReadBtn);

  // Toggle content button
  const toggleBtn = document.createElement("button");
  toggleBtn.className = "entry-action-btn";
  toggleBtn.type = "button";
  toggleBtn.title = chrome.i18n.getMessage("pagePopupShowContent");
  toggleBtn.replaceChildren(createSvg(svg_path_toggle_open));

  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();

    const entryContent = document.getElementById(`entryContent-${entry.id}`);
    const entryContainer = document.getElementById(`entry-${entry.id}`);

    if (!entryContainer) return;

    if (entryContent) {
      // Collapse
      titleContainer.classList.remove("expanded");
      toggleBtn.replaceChildren(createSvg(svg_path_toggle_open));
      toggleBtn.title = chrome.i18n.getMessage("pagePopupShowContent");
      entryContent.remove();
    } else {
      // Expand
      titleContainer.classList.add("expanded");
      toggleBtn.replaceChildren(createSvg(svg_path_toggle_close));
      toggleBtn.title = chrome.i18n.getMessage("pagePopupHideContent");
      entryContainer.appendChild(createEntryContent(entry));
    }
  });
  actions.appendChild(toggleBtn);

  // Assemble
  meta.appendChild(feedInfo);
  meta.appendChild(stats);
  meta.appendChild(actions);

  titleContainer.appendChild(titleText);
  titleContainer.appendChild(meta);

  return titleContainer;
};

/**
 * Create complete entry DOM
 * @param {string} domId
 * @param {Entry} entry
 * @returns {Promise<HTMLDivElement>}
 */
const createEntry = async (domId, entry) => {
  const entryElement = document.createElement("div");
  entryElement.id = domId;
  entryElement.dataset.entryId = entry.id;
  entryElement.dataset.timestamp = new Date(entry.published_at).getTime();
  entryElement.className = "entry";

  const title = await createEntryTitle(entry);
  entryElement.appendChild(title);

  return entryElement;
};

/**
 * Add single entry to DOM
 * @param {Entry} entry
 * @returns {Promise<void>}
 */
export const addDOMEntry = async (entry) => {
  const domId = `entry-${entry.id}`;
  const existing = document.getElementById(domId);

  if (existing) return;

  const entryElement = await createEntry(domId, entry);

  // Re-check after the await: a concurrent refresh may have rendered the
  // same entry while createEntry was awaiting the icon.
  if (document.getElementById(domId)) return;

  const container = document.querySelector(".entries");

  if (container) {
    container.appendChild(entryElement);
  }
};

/**
 * Add multiple entries to DOM
 * @param {Entry[]} entries
 * @returns {Promise<void>}
 */
export const addDOMEntries = async (entries) => {
  if (!entries?.length) return;

  await Promise.all(filterVisibleEntries(entries).map(addDOMEntry));
  sortDOMEntries();
};

/**
 * Remove old entries from DOM
 * @param {Entry[]} newEntries
 */
export const cleanupOldDOMEntries = (newEntries) => {
  const container = document.querySelector(".entries");
  if (!container) return;

  const currentEntries = Array.from(container.querySelectorAll(".entry"));
  const newEntryIds = new Set(newEntries.map((entry) => entry.id));

  currentEntries.forEach((domEntry) => {
    const entryId = Number(domEntry.dataset.entryId);
    if (!newEntryIds.has(entryId)) {
      domEntry.remove();
    }
  });
};

/**
 * Refresh entries view
 * @returns {Promise<void>}
 */
const handleRefreshViewEntries = async () => {
  try {
    const entries = await browser.storage.local
      .get("entries")
      .then((r) => r.entries || []);

    // Filter out hidden feeds/categories so entries that became hidden are
    // removed from the DOM as well (they stay in storage, so they are not
    // re-notified as new and reappear if the filter is reverted in Miniflux).
    const visibleEntries = filterVisibleEntries(entries);
    cleanupOldDOMEntries(visibleEntries);
    await addDOMEntries(visibleEntries);
    updateEmptyState();
  } catch (error) {
    console.error("Failed to refresh entries:", error);
  }
};

// ============================================================================
// UI Handlers
// ============================================================================

/**
 * Setup dropdown menu
 */
const setupDropdown = () => {
  const button = document.getElementById("dropdownMenuButton");
  const menu = document.getElementById("dropdownMenu");

  if (!button || !menu) return;

  const toggleDropdown = () => {
    state.dropdownOpen = !state.dropdownOpen;
    document.body.classList.toggle("dropdown-open");
    menu.classList.toggle("show", state.dropdownOpen);
    button.setAttribute("aria-expanded", String(state.dropdownOpen));
  };

  const closeDropdown = () => {
    state.dropdownOpen = false;
    document.body.classList.remove("dropdown-open");
    menu.classList.remove("show");
    button.setAttribute("aria-expanded", "false");
  };

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDropdown();
  });

  // Close on click outside
  document.addEventListener("click", (e) => {
    if (
      state.dropdownOpen &&
      !menu.contains(e.target) &&
      !button.contains(e.target)
    ) {
      closeDropdown();
    }
  });

  // Close on menu item click (prevent the href="#" navigation)
  menu.querySelectorAll(".dropdown-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      closeDropdown();
    });
  });

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.dropdownOpen) {
      closeDropdown();
      button.focus();
    }
  });
};

/**
 * Setup mark all as read button
 */
const setupMarkAllAsReadButton = () => {
  const button = document.getElementById("btnMarkEntriesAsRead");
  if (!button) return;

  const icon = button.querySelector(".icon");
  if (!icon) return;
  const pathElement = icon.querySelector("path");
  if (!pathElement) return;
  const previousIconPath = pathElement.getAttribute("d");

  button.addEventListener("click", async () => {
    if (!button.classList.contains("danger")) {
      // First click: show confirmation
      button.classList.add("danger");
      pathElement.setAttribute("d", svg_path_question_mark); // Change to question mark
      button.title = chrome.i18n.getMessage(
        "pagePopupAreYouSureToMarkAllEntriesAsRead",
      );

      if (state.confirmMarkAllEntriesTimeout) {
        clearTimeout(state.confirmMarkAllEntriesTimeout);
        state.confirmMarkAllEntriesTimeout = null;
      }

      state.confirmMarkAllEntriesTimeout = setTimeout(() => {
        state.confirmMarkAllEntriesTimeout = null;
        button.classList.remove("danger");
        pathElement.setAttribute("d", previousIconPath); // Restore original icon
        button.title = chrome.i18n.getMessage("pagePopupMarkEntriesAsRead");
      }, MARK_ENTRIES_AS_READ_TIMEOUT_MS);
    } else {
      // Second click: execute
      if (state.confirmMarkAllEntriesTimeout) {
        clearTimeout(state.confirmMarkAllEntriesTimeout);
        state.confirmMarkAllEntriesTimeout = null;
      }

      const entryIds = Array.from(document.querySelectorAll(".entry"))
        .map((entry) => Number(entry.dataset.entryId))
        .filter((id) => !isNaN(id));

      button.disabled = true;
      icon.classList.add("loading");

      try {
        if (entryIds.length > 0) {
          await browser.runtime.sendMessage({
            action: MESSAGE_MARK_ENTRY_IDS_AS_READ,
            entryIds,
          });
        }
      } catch (error) {
        console.error("Failed to mark all as read:", error);
      } finally {
        button.disabled = false;
        icon.classList.remove("loading");
        pathElement.setAttribute("d", previousIconPath); // Restore original icon
        button.classList.remove("danger");
        button.title = chrome.i18n.getMessage("pagePopupMarkEntriesAsRead");
        updateEmptyState();
      }
    }
  });
};

/**
 * Setup refresh button
 */
const setupRefreshButton = () => {
  const button = document.getElementById("btnRefresh");
  if (!button) return;

  const icon = button.querySelector(".icon");
  if (!icon) return;

  button.addEventListener("click", async () => {
    try {
      button.disabled = true;
      icon.classList.add("loading");

      await refreshEntries();
      await handleRefreshViewEntries();
    } catch (error) {
      if (error instanceof InvalidUrlOrTokenError) {
        await openSettings();
      } else {
        console.error("Failed to refresh:", error);
      }
    } finally {
      button.disabled = false;
      icon.classList.remove("loading");
    }
  });
};

/**
 * Open Miniflux
 */
const openMiniflux = async () => {
  const url = await browser.storage.local.get("url").then((data) => data.url);
  if (!url) return openSettings();
  await openLink(url);
};

/**
 * Initialize the popup
 */
const initializePopup = async () => {
  // Configure DOMPurify
  DOMPurify.addHook("uponSanitizeElement", (node, data) => {
    const src =
      (typeof node.getAttribute === "function"
        ? node.getAttribute("src")
        : "") || "";

    switch (data.tagName) {
      case "iframe": {
        const isYoutubeEmbed =
          src.startsWith("https://www.youtube.com/embed/") ||
          src.startsWith("https://www.youtube-nocookie.com/embed/");

        if (!isYoutubeEmbed && node.parentNode) {
          node.parentNode.removeChild(node);
        }
        break;
      }
      case "img": {
        const isYoutubePlaceholder = /youtube_[\w]+_placeholder\.[\w]+/.test(
          src,
        );

        if (isYoutubePlaceholder && node.parentNode) {
          node.parentNode.removeChild(node);
        }
        break;
      }
    }
  });

  // Apply popup style
  const style = getPopupStyle();
  document.body.classList.add(style);

  // Apply theme
  await refreshTheme();

  // Setup UI
  setupDropdown();
  setupMarkAllAsReadButton();
  setupRefreshButton();

  // Setup button handlers
  const btnOpenMiniflux = document.getElementById("btnOpenMiniflux");
  btnOpenMiniflux?.addEventListener("click", openMiniflux);

  const btnToggleTheme = document.getElementById("btnToggleTheme");
  btnToggleTheme?.addEventListener("click", async () => {
    const html = document.documentElement;
    const currentTheme = html.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";

    html.setAttribute("data-theme", newTheme);
    await browser.storage.local.set({ theme: newTheme });
    await notifyRefreshTheme();
  });

  const btnOpenWindow = document.getElementById("btnOpenWindow");
  btnOpenWindow?.addEventListener("click", async () => {
    await browser.windows.create({
      url: "/pages/popup.html?style=window",
      type: "popup",
      width: 360,
      height: 600,
    });

    await browser.sidebarAction?.close();
    window.close();
  });

  const btnOpenSidePanel = document.getElementById("btnOpenSidePanel");
  btnOpenSidePanel?.addEventListener("click", async () => {
    if (browser.sidebarAction) {
      await browser.sidebarAction.toggle();
    } else {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });

      if (tab?.windowId) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      }
    }

    window.close();
  });

  const btnSettings = document.getElementById("btnSettings");
  btnSettings?.addEventListener("click", openSettings);

  // Load initial entries
  await handleRefreshViewEntries();
};

// ============================================================================
// Message Listener
// ============================================================================

browser.runtime.onMessage.addListener((message) => {
  if (message.action === MESSAGE_REFRESH_VIEW_ENTRIES) {
    return handleRefreshViewEntries().catch((error) => {
      console.error("Error refreshing entries:", error);
    });
  }

  if (message.action === MESSAGE_REFRESH_THEME) {
    return refreshTheme().catch((error) => {
      console.error("Error refreshing theme:", error);
    });
  }

  return false;
});

// ============================================================================
// Initialize
// ============================================================================

document.addEventListener("DOMContentLoaded", initializePopup);
