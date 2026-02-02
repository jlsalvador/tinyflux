/* global document, URLSearchParams, window, console, chrome, setTimeout, clearTimeout */

"use strict";

import "./localize.js";
import browser from "webextension-polyfill";
import { TimeAgo, Style } from "./timeago.js";
import DOMPurify from "dompurify";
import {
  DEFAULT_MARK_ENTRY_AS_READ_WHEN_OPENED_AS_TAB,
  MESSAGE_MARK_ENTRY_IDS_AS_READ,
  MESSAGE_REFRESH_THEME,
  MESSAGE_REFRESH_VIEW_ENTRIES,
  notifyRefreshTheme,
  refreshEntries,
  refreshTheme,
  request,
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
const ICON_CACHE_KEY_PREFIX = "icon";

// ============================================================================
// State Management
// ============================================================================

const state = {
  iconCache: new Map(),
  confirmMarkAllEntriesTimeout: null,
  dropdownOpen: false,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get popup style from URL parameters
 * @returns {string}
 */
const getPopupStyle = () => {
  return new URLSearchParams(window.location.search).get("style") || "popup";
};

/**
 * Close window if in popup mode
 */
const closeIfPopup = () => {
  if (getPopupStyle() === "popup") {
    window.close();
  }
};

/**
 * Open a URL in a new tab
 * @param {string} url
 * @param {boolean} active
 * @returns {Promise<browser.tabs.Tab>}
 */
const openLink = async (url, active = true) => {
  const tab = await browser.tabs.create({ active, url });
  closeIfPopup();

  if (!active && tab?.id) {
    await browser.tabs.discard(tab.id);
  }

  return tab;
};

/**
 * Create an SVG element
 * @param {string} path - SVG path data
 * @param {string} className - CSS class name
 * @returns {SVGElement}
 */
const createIcon = (path, className = "icon") => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");

  const pathElement = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  pathElement.setAttribute("d", path);

  svg.appendChild(pathElement);
  return svg;
};

// ============================================================================
// Icon Management
// ============================================================================

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

  // Check storage cache
  const cacheKey = `${ICON_CACHE_KEY_PREFIX}${iconID}`;
  const cachedIcon = await browser.storage.local
    .get(cacheKey)
    .then((data) => data[cacheKey]);

  if (cachedIcon) {
    state.iconCache.set(iconID, cachedIcon);
    return cachedIcon;
  }

  // Fetch from API
  try {
    const response = await request(`/v1/icons/${iconID}`);

    if (response.status !== 200) {
      console.error("Failed to fetch icon:", response);
      return { data: "" };
    }

    const icon = await response.json();

    // Cache the icon
    state.iconCache.set(iconID, icon);
    await browser.storage.local.set({ [cacheKey]: icon });

    return icon;
  } catch (error) {
    console.error("Error fetching icon:", error);
    return { data: "" };
  }
};

// ============================================================================
// Entry Management
// ============================================================================

/**
 * Toggle bookmark status
 * @param {number} entryId
 * @returns {Promise<Response>}
 */
const toggleBookmark = async (entryId) => {
  return request(`/v1/entries/${entryId}/bookmark`, { method: "PUT" });
};

/**
 * Sort DOM entries by published date (descending)
 */
const sortDOMEntries = () => {
  const container = document.querySelector(".entries");
  if (!container) return;

  const entries = Array.from(container.querySelectorAll(".entry"));

  entries
    .sort((a, b) => {
      const dateA = new Date(a.dataset.entryPublishedAt);
      const dateB = new Date(b.dataset.entryPublishedAt);
      return dateB - dateA;
    })
    .forEach((entry) => container.appendChild(entry));
};

/**
 * Create entry content DOM
 * @param {Entry} entry
 * @returns {HTMLDivElement}
 */
const createEntryContent = (entry) => {
  const content = document.createElement("div");
  content.id = `entryContent-${entry.id}`;
  content.className = "entry-content";
  content.innerHTML = DOMPurify.sanitize(entry.content, {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling"],
    ALLOWED_URI_REGEXP:
      /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix|magnet):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  });

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
      await browser.runtime.sendMessage({
        action: MESSAGE_MARK_ENTRY_IDS_AS_READ,
        entryIds: [entry.id],
      });
    }

    await openLink(entry.url);
  });

  // Metadata container
  const meta = document.createElement("div");
  meta.className = "entry-meta";

  // Feed info
  const icon = await getIcon(entry.feed.icon.icon_id);
  const feedInfo = document.createElement("div");
  feedInfo.className = "entry-feed-info";
  feedInfo.title = entry.feed.title;

  if (icon.data) {
    const feedIcon = document.createElement("img");
    feedIcon.className = "feed-icon";
    feedIcon.src = `data:${icon.data}`;
    feedIcon.alt = entry.feed.title;
    feedInfo.appendChild(feedIcon);
  }

  const feedTitle = document.createElement("span");
  feedTitle.className = "feed-title";
  feedTitle.textContent = entry.feed.title;
  feedInfo.appendChild(feedTitle);

  feedInfo.addEventListener("click", () => openLink(entry.feed.site_url));

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
  publishedStat.innerHTML = `
    ${createIcon("M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z").outerHTML}
    <span>${TimeAgo(entry.published_at, Style.ExtremeNarrow)}</span>
  `;
  stats.appendChild(publishedStat);

  // Reading time
  const readingTimeStat = document.createElement("div");
  readingTimeStat.className = "entry-stat";
  readingTimeStat.title =
    entry.reading_time === 1
      ? browser.i18n.getMessage(
          "pagePopupReadingTimeSingular",
          entry.reading_time,
        )
      : browser.i18n.getMessage(
          "pagePopupReadingTimePlural",
          entry.reading_time,
        );
  readingTimeStat.innerHTML = `
    ${createIcon("M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-1 0A7 7 0 1 0 1 8a7 7 0 0 0 14 0z").outerHTML}
    <span>${browser.i18n.getMessage("pagePopupReadingTimeShort", entry.reading_time)}</span>
  `;
  stats.appendChild(readingTimeStat);

  // Actions
  const actions = document.createElement("div");
  actions.className = "entry-actions";

  // Bookmark button
  const bookmarkBtn = document.createElement("button");
  bookmarkBtn.className = `entry-action-btn ${entry.starred ? "starred" : ""}`;
  bookmarkBtn.type = "button";
  bookmarkBtn.title = browser.i18n.getMessage("pagePopupToggleBookmark");
  bookmarkBtn.innerHTML = entry.starred
    ? createIcon(
        "M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z",
      ).outerHTML
    : createIcon(
        "M2.866 14.85c-.078.444.36.791.746.593l4.39-2.256 4.389 2.256c.386.198.824-.149.746-.592l-.83-4.73 3.522-3.356c.33-.314.16-.888-.282-.95l-4.898-.696L8.465.792a.513.513 0 0 0-.927 0L5.354 5.12l-4.898.696c-.441.062-.612.636-.283.95l3.523 3.356-.83 4.73zm4.905-2.767-3.686 1.894.694-3.957a.565.565 0 0 0-.163-.505L1.71 6.745l4.052-.576a.525.525 0 0 0 .393-.288L8 2.223l1.847 3.658a.525.525 0 0 0 .393.288l4.052.575-2.906 2.77a.565.565 0 0 0-.163.506l.694 3.957-3.686-1.894a.503.503 0 0 0-.461 0z",
      ).outerHTML;

  bookmarkBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const isStarred = bookmarkBtn.classList.contains("starred");

    try {
      await toggleBookmark(entry.id);

      // Update cache
      const entries = await browser.storage.local
        .get("entries")
        .then((data) => data.entries || []);
      const updatedEntries = entries.map((e) => {
        if (e.id === entry.id) {
          return { ...e, starred: !isStarred };
        }
        return e;
      });
      await browser.storage.local.set({ entries: updatedEntries });

      // Update UI
      bookmarkBtn.classList.toggle("starred");
      bookmarkBtn.innerHTML = !isStarred
        ? createIcon(
            "M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z",
          ).outerHTML
        : createIcon(
            "M2.866 14.85c-.078.444.36.791.746.593l4.39-2.256 4.389 2.256c.386.198.824-.149.746-.592l-.83-4.73 3.522-3.356c.33-.314.16-.888-.282-.95l-4.898-.696L8.465.792a.513.513 0 0 0-.927 0L5.354 5.12l-4.898.696c-.441.062-.612.636-.283.95l3.523 3.356-.83 4.73zm4.905-2.767-3.686 1.894.694-3.957a.565.565 0 0 0-.163-.505L1.71 6.745l4.052-.576a.525.525 0 0 0 .393-.288L8 2.223l1.847 3.658a.525.525 0 0 0 .393.288l4.052.575-2.906 2.77a.565.565 0 0 0-.163.506l.694 3.957-3.686-1.894a.503.503 0 0 0-.461 0z",
          ).outerHTML;
    } catch (error) {
      console.error("Failed to toggle bookmark:", error);
    }
  });
  actions.appendChild(bookmarkBtn);

  // Mark as read button
  const markReadBtn = document.createElement("button");
  markReadBtn.className = "entry-action-btn";
  markReadBtn.type = "button";
  markReadBtn.title = browser.i18n.getMessage("pagePopupMarkAsRead");
  markReadBtn.innerHTML = createIcon(
    "M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z",
  ).outerHTML;

  markReadBtn.addEventListener("click", async (e) => {
    e.stopPropagation();

    try {
      markReadBtn.disabled = true;
      markReadBtn.querySelector(".icon").classList.add("loading");

      await browser.runtime.sendMessage({
        action: MESSAGE_MARK_ENTRY_IDS_AS_READ,
        entryIds: [entry.id],
      });
    } catch (error) {
      console.error("Failed to mark as read:", error);
    } finally {
      markReadBtn.disabled = false;
      markReadBtn.querySelector(".icon").classList.remove("loading");
    }
  });
  actions.appendChild(markReadBtn);

  // Toggle content button
  const toggleBtn = document.createElement("button");
  toggleBtn.className = "entry-action-btn";
  toggleBtn.type = "button";
  toggleBtn.title = browser.i18n.getMessage("pagePopupShowContent");
  toggleBtn.innerHTML = createIcon(
    "M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z",
  ).outerHTML;

  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();

    const entryContent = document.getElementById(`entryContent-${entry.id}`);
    const entryContainer = document.getElementById(`entry-${entry.id}`);

    if (!entryContainer) return;

    if (entryContent) {
      // Collapse
      titleContainer.classList.remove("expanded");
      toggleBtn.innerHTML = createIcon(
        "M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z",
      ).outerHTML;
      toggleBtn.title = browser.i18n.getMessage("pagePopupShowContent");
      entryContent.remove();
    } else {
      // Expand
      titleContainer.classList.add("expanded");
      toggleBtn.innerHTML = createIcon(
        "M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z",
      ).outerHTML;
      toggleBtn.title = browser.i18n.getMessage("pagePopupHideContent");
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
  entryElement.dataset.entryPublishedAt = entry.published_at;
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
const addDOMEntry = async (entry) => {
  const domId = `entry-${entry.id}`;
  const existing = document.getElementById(domId);

  if (existing) return;

  const entryElement = await createEntry(domId, entry);
  const container = document.querySelector(".entries");

  if (container) {
    container.appendChild(entryElement);
    sortDOMEntries();
  }
};

/**
 * Add multiple entries to DOM
 * @param {Entry[]} entries
 * @returns {Promise<void>}
 */
const addDOMEntries = async (entries) => {
  if (!entries?.length) return;

  const filtered = entries
    .filter((entry) => !entry.feed?.hide_globally)
    .filter((entry) => !entry.feed?.category?.hide_globally);

  await Promise.all(filtered.map(addDOMEntry));
};

/**
 * Remove old entries from DOM
 * @param {Entry[]} newEntries
 */
const cleanupOldDOMEntries = (newEntries) => {
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

    cleanupOldDOMEntries(entries);
    await addDOMEntries(entries);

    // Show/hide empty state
    const isEmpty = document.getElementById("isEmpty");
    const hasEntries = document.querySelectorAll(".entry").length > 0;

    if (isEmpty) {
      isEmpty.classList.toggle("hidden", hasEntries);
    }
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
    menu.classList.toggle("show", state.dropdownOpen);
    button.setAttribute("aria-expanded", String(state.dropdownOpen));
  };

  const closeDropdown = () => {
    state.dropdownOpen = false;
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

  // Close on menu item click
  menu.querySelectorAll(".dropdown-item").forEach((item) => {
    item.addEventListener("click", closeDropdown);
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
  const pathElement = icon.querySelector("path");

  // Store original icon SVG
  const originalIconPath = pathElement.getAttribute("d");
  const questionIconPath =
    "M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 0 0 .25.246h.811a.25.25 0 0 0 .25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286zm1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94z";

  button.addEventListener("click", async () => {
    if (!button.classList.contains("danger")) {
      // First click: show confirmation
      button.classList.add("danger");
      pathElement.setAttribute("d", questionIconPath); // Change to question mark
      button.title = browser.i18n.getMessage(
        "pagePopupAreYouSureToMarkAllEntriesAsRead",
      );

      if (state.confirmMarkAllEntriesTimeout) {
        clearTimeout(state.confirmMarkAllEntriesTimeout);
      }

      state.confirmMarkAllEntriesTimeout = setTimeout(() => {
        button.classList.remove("danger");
        pathElement.setAttribute("d", originalIconPath); // Restore original icon
        button.title = browser.i18n.getMessage("pagePopupMarkEntriesAsRead");
      }, MARK_ENTRIES_AS_READ_TIMEOUT_MS);
    } else {
      // Second click: execute
      if (state.confirmMarkAllEntriesTimeout) {
        clearTimeout(state.confirmMarkAllEntriesTimeout);
      }

      try {
        button.disabled = true;
        icon.classList.add("loading");

        const entryIds = Array.from(document.querySelectorAll(".entry"))
          .map((entry) => Number(entry.dataset.entryId))
          .filter((id) => !isNaN(id));

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
        pathElement.setAttribute("d", originalIconPath); // Restore original icon
        button.classList.remove("danger");
        button.title = browser.i18n.getMessage("pagePopupMarkEntriesAsRead");
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

  button.addEventListener("click", async () => {
    try {
      button.disabled = true;
      icon.classList.add("loading");

      await refreshEntries();
      await handleRefreshViewEntries();
    } catch (error) {
      console.error("Failed to refresh:", error);
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
      typeof node.getAttribute === "function" ? node.getAttribute("src") : "";

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

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === MESSAGE_REFRESH_VIEW_ENTRIES) {
    handleRefreshViewEntries()
      .then(() => sendResponse())
      .catch((error) => {
        console.error("Error refreshing entries:", error);
        sendResponse();
      });
    return true;
  } else if (message.action === MESSAGE_REFRESH_THEME) {
    refreshTheme()
      .then(() => sendResponse())
      .catch((error) => {
        console.error("Error refreshing theme:", error);
        sendResponse();
      });
    return true;
  }

  return false;
});

// ============================================================================
// Initialize
// ============================================================================

document.addEventListener("DOMContentLoaded", initializePopup);
