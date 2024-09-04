"use strict";

import browser from "webextension-polyfill";
import { TimeAgo, Style } from "./timeago.js";
import DOMPurify from "dompurify";
import {
  request,
  updateBadge,
  refreshEntries,
  openSettings,
  refreshAlarms,
} from "./common.js";

/**
 * @typedef {import('./common.js').Enclosure} Enclosure
 * @typedef {import('./common.js').Category} Category
 * @typedef {import('./common.js').FeedIcon} FeedIcon
 * @typedef {import('./common.js').Feed} Feed
 * @typedef {import('./common.js').Entry} Entry
 * @typedef {import('./common.js').Icon} Icon
 */

async function toggleBookmark(entryId) {
  return request(`/v1/entries/${entryId}/bookmark`, {
    method: "PUT",
  });
}

async function markEntriesAsRead() {
  const entryIds = [];
  const domEntries = document.querySelector(".entries");
  const entries = domEntries.getElementsByClassName("entry");
  for (const entry of entries) {
    entryIds.push(Number(entry.dataset.entryId));
  }

  if (entryIds.length === 0) {
    return;
  }

  return request(`/v1/entries`, {
    method: "PUT",
    body: JSON.stringify({
      entry_ids: entryIds,
      status: "read",
    }),
  });
}

async function markEntryAsRead(entryId) {
  return request(`/v1/entries`, {
    method: "PUT",
    body: JSON.stringify({ entry_ids: [entryId], status: "read" }),
  });
}

/**
 * @param {string} url
 * @returns
 */
async function openLink(url) {
  const active = true;
  const result = browser.tabs.create({
    active: active,
    url: url,
  });

  const style =
    new URLSearchParams(window.location.search).get("style") || "popup";
  if (style === "popup") {
    window.close();
  }

  if (!active) {
    return result.then(tab => browser.tabs.discard(tab.id))
  }
  return result;
}

/**
 * @param {Entry[]} entries
 */
async function addEntries(entries) {
  if (!entries || !entries.length === 0) {
    return Promise.resolve();
  }

  return Promise.all(entries.map((entry) => addEntry(entry)));
}

/**
 * @param {Entry[]} newEntries
 */
function cleanupOldEntries(newEntries) {
  const domEntries = document.querySelector(".entries");
  const currentEntries = domEntries.getElementsByClassName("entry");

  // We only need the new entries IDs to compare with the current ones.
  const newEntriesIds = newEntries.map((newEntry) => newEntry.id);

  // Check if the current entries are still in the new ones, if not, save it into a list to be deleted.
  const domsToBeDeleted = Array.from(currentEntries).filter(
    (currentEntry) => newEntriesIds.indexOf(currentEntry.dataset.entryId) === -1
  );

  // Delete the DOM elements that are not in the new ones.
  domsToBeDeleted.forEach((domToBeDeleted) => {
    domToBeDeleted.remove();
  });

  return Promise.resolve();
}

/**
 * @param {Entry} entry
 */
async function addEntry(entry) {
  function sortEntries() {
    const domEntries = document.querySelector(".entries");
    const entries = domEntries.getElementsByClassName("entry");
    [...entries]
      .sort(
        (a, b) =>
          new Date(a.dataset.entryPublishedAt) <
          new Date(b.dataset.entryPublishedAt)
      )
      .forEach((entry) => domEntries.appendChild(entry));
  }

  /**
   * @param {Entry} entry
   * @returns
   */
  function createEntryContent(entry) {
    const domEntryContent = document.createElement("div");
    domEntryContent.id = `entryContent-${entry.id}`;
    domEntryContent.className = "entryContent";
    domEntryContent.innerHTML = DOMPurify.sanitize(entry.content);

    return domEntryContent;
  }

  /**
   * @param {Entry} entry
   * @returns
   */
  const createDomEntryTitle = async function (entry) {
    const domEntryTitleRowColumnEntryTitleText = document.createElement("div");
    domEntryTitleRowColumnEntryTitleText.className = "entryTitleText";
    domEntryTitleRowColumnEntryTitleText.title = "Open in new tab"; //TODO i18n
    domEntryTitleRowColumnEntryTitleText.innerText = entry.title;

    const domEntryTitleRowColumn = document.createElement("div");
    domEntryTitleRowColumn.className = "col";
    domEntryTitleRowColumn.append(domEntryTitleRowColumnEntryTitleText);
    domEntryTitleRowColumn.addEventListener("click", () => {
      return openLink(entry.url);
    });

    const domEntryTitleRow = document.createElement("div");
    domEntryTitleRow.className = "row";
    domEntryTitleRow.append(domEntryTitleRowColumn);

    const icon = await getIcon(entry.feed.icon.icon_id);

    const domEntryTitleFeedRowColSpanFeedInfoFavIcon =
      document.createElement("img");
    domEntryTitleFeedRowColSpanFeedInfoFavIcon.className = "feedIcon";
    domEntryTitleFeedRowColSpanFeedInfoFavIcon.title = entry.feed.title;
    domEntryTitleFeedRowColSpanFeedInfoFavIcon.src = `data:${icon.data}`;

    const domEntryTitleFeedRowColSpanFeedInfo = document.createElement("span");
    domEntryTitleFeedRowColSpanFeedInfo.className = "entryTitleFeedInfo";
    domEntryTitleFeedRowColSpanFeedInfo.title = entry.feed.title;
    domEntryTitleFeedRowColSpanFeedInfo.append(
      domEntryTitleFeedRowColSpanFeedInfoFavIcon
    );
    domEntryTitleFeedRowColSpanFeedInfo.append(entry.feed.title);
    domEntryTitleFeedRowColSpanFeedInfo.addEventListener("click", () => {
      return openLink(entry.feed.site_url);
    });

    const iconCalendar = document.createElement("span");
    iconCalendar.className = "icon-calendar";

    const domEntryTitleFeedRowFeeddInfo = document.createElement("div");
    domEntryTitleFeedRowFeeddInfo.append(domEntryTitleFeedRowColSpanFeedInfo);

    const domEntryTitleFeedRowColSpanFeedPublished =
      document.createElement("span");
    domEntryTitleFeedRowColSpanFeedPublished.className = "entryTitleFeedInfo";
    domEntryTitleFeedRowColSpanFeedPublished.title = `Published ${new Date(
      entry.published_at
    ).toLocaleString(undefined, {
      dateStyle: "full",
      timeStyle: "long",
    })}`; //TODO i18n
    domEntryTitleFeedRowColSpanFeedPublished.append(iconCalendar);
    domEntryTitleFeedRowColSpanFeedPublished.append(
      ` ${TimeAgo(entry.published_at, Style.ExtremeNarrow)}`
    );

    const iconClock = document.createElement("span");
    iconClock.className = "icon-clock";

    const domEntryTitleFeedRowColSpanFeedReadingTime =
      document.createElement("span");
    domEntryTitleFeedRowColSpanFeedReadingTime.className = "entryTitleFeedInfo";
    domEntryTitleFeedRowColSpanFeedReadingTime.title = `${entry.reading_time} ${
      entry.reading_time === 1 ? "minute" : "minutes"
    } to read`; //TODO i18n
    domEntryTitleFeedRowColSpanFeedReadingTime.append(iconClock);
    domEntryTitleFeedRowColSpanFeedReadingTime.append(
      ` ${entry.reading_time}m`
    ); //TODO i18n

    const domEntryTitleFeedRowStats = document.createElement("div");
    domEntryTitleFeedRowStats.append(domEntryTitleFeedRowColSpanFeedPublished);
    domEntryTitleFeedRowStats.append(
      domEntryTitleFeedRowColSpanFeedReadingTime
    );

    const iconBookmark = document.createElement("span");
    iconBookmark.className = entry.starred
      ? "icon-bookmarked"
      : "icon-bookmark";

    const domBtnToggleBookmark = document.createElement("button");
    domBtnToggleBookmark.type = "button";
    domBtnToggleBookmark.title = "Toggle bookmark"; //TODO i18n
    domBtnToggleBookmark.className = "entryButton";
    domBtnToggleBookmark.append(iconBookmark);
    domBtnToggleBookmark.addEventListener("click", async (event) => {
      const icon = event.target;
      const isBookmarked = icon.classList.contains("icon-bookmarked");
      return toggleBookmark(entry.id).then(async () => {
        await browser.storage.local
          .get("entries")
          .then((data) => data.entries)
          .then((entries) =>
            entries.map((e) => {
              if (e.id === entry.id) {
                e.starred = !isBookmarked;
              }
              return e;
            })
          )
          .then((entries) => {
            return browser.storage.local.set({ entries: entries });
          }); // Update local cache
        if (isBookmarked) {
          icon.classList.remove("icon-bookmarked");
          icon.classList.add("icon-bookmark");
        } else {
          icon.classList.remove("icon-bookmark");
          icon.classList.add("icon-bookmarked");
        }
      });
    });

    const iconMarkAsRead = document.createElement("span");
    iconMarkAsRead.className = "icon-mark-as-read";

    const domBtnMarkAsRead = document.createElement("button");
    domBtnMarkAsRead.type = "button";
    domBtnMarkAsRead.title = "Mark as read"; //TODO i18n
    domBtnMarkAsRead.className = "entryButton";
    domBtnMarkAsRead.append(iconMarkAsRead);
    domBtnMarkAsRead.addEventListener("click", () => {
      return Promise.all([
        markEntryAsRead(entry.id), // Mark as read to the Miniflux API
        document.getElementById(`entry-${entry.id}`)?.remove(), // Remove from the view
        browser.storage.local
          .get("entries")
          .then((data) => data.entries)
          .then((entries) => entries.filter((e) => e.id != entry.id))
          .then(async (entries) => {
            // Remove from the local cache
            await browser.storage.local.set({ entries: entries });
            await updateBadge(entries.length);
            return entries;
          }),
      ]);
    });

    const iconUncollapse = document.createElement("span");
    iconUncollapse.className = "icon-uncollapse";

    const iconCollapse = document.createElement("span");
    iconCollapse.className = "icon-collapse";

    const domBtnToggleContent = document.createElement("button");
    domBtnToggleContent.type = "button";
    domBtnToggleContent.title = "Show content"; //TODO i18n
    domBtnToggleContent.className = "entryButton";
    domBtnToggleContent.addEventListener("click", () => {
      const domEntryContent = document.getElementById(
        `entryContent-${entry.id}`
      );
      const domEntryTitle = document.getElementById(`entryTitle-${entry.id}`);

      domBtnToggleContent.innerHTML = "";
      if (domEntryContent === null) {
        domEntryTitle.classList.add("uncollapsed");
        domBtnToggleContent.append(iconCollapse);
        domBtnToggleContent.title = "Collapse content"; //TODO i18n

        const domEntry = document.getElementById(`entry-${entry.id}`);
        if (domEntry === null) {
          return;
        }
        domEntry.append(createEntryContent(entry));
      } else {
        domEntryTitle.classList.remove("uncollapsed");
        domBtnToggleContent.append(iconUncollapse);
        domBtnToggleContent.title = "Show content"; //TODO i18n

        domEntryContent.remove();
      }
    });
    domBtnToggleContent.append(iconUncollapse);

    const domEntryTitleFeedRowActions = document.createElement("div");
    domEntryTitleFeedRowActions.append(domBtnToggleBookmark);
    domEntryTitleFeedRowActions.append(domBtnMarkAsRead);
    domEntryTitleFeedRowActions.append(domBtnToggleContent);

    const domEntryTitleFeedRow = document.createElement("div");
    domEntryTitleFeedRow.className = "entryTitleFeed";
    domEntryTitleFeedRow.append(domEntryTitleFeedRowFeeddInfo);
    domEntryTitleFeedRow.append(domEntryTitleFeedRowStats);
    domEntryTitleFeedRow.append(domEntryTitleFeedRowActions);

    const domEntryTitle = document.createElement("div");
    domEntryTitle.id = `entryTitle-${entry.id}`;
    domEntryTitle.className = "entryTitle";
    domEntryTitle.append(domEntryTitleRow);
    domEntryTitle.append(domEntryTitleFeedRow);

    return domEntryTitle;
  };

  const domId = `entry-${entry.id}`;

  // Construct DOM Entry
  const domEntry = document.createElement("div");
  domEntry.id = domId;
  domEntry.dataset.entryId = entry.id;
  domEntry.dataset.entryPublishedAt = entry.published_at;
  domEntry.className = "entry";
  const entryTitle = await createDomEntryTitle(entry);
  domEntry.append(entryTitle);

  // Don't re-add the same entry. Replace the old one.
  const oldSameEntry = document.getElementById(domId);
  if (oldSameEntry) {
    oldSameEntry.replaceWith(domEntry);
    return;
  } else {
    const domEntries = document.querySelector(".entries");
    domEntries.append(domEntry);
  }

  // Sort entries
  sortEntries();
}

/**
 * Fetch `Icon` from `browser.storage.local` or from the Miniflux API.
 *
 * @param {number} iconID
 */
async function getIcon(iconID) {
  const id = `icon${iconID}`;
  const icon = await browser.storage.local.get(id).then((data) => data[id]);
  if (icon) {
    return icon;
  }

  return await request(`/v1/icons/${iconID}`).then(async (response) => {
    if (response.status !== 200) {
      console.error(response);
      return {};
    }
    const result = await response.json();
    const obj = {};
    obj[id] = result;
    await browser.storage.local.set(obj);
    return result;
  });
}

async function loadCachedEntries() {
  browser.storage.local.get("entries").then(async (data) => {
    const entries = data.entries;
    await addEntries(entries);
    await updateBadge(entries.length);
    return entries;
  });
}

async function refreshViewEntries() {
  return refreshEntries()
    .then((entries) =>
      Promise.all([cleanupOldEntries(entries), addEntries(entries)])
    )
    .then(refreshAlarms);
}

document.addEventListener("DOMContentLoaded", () => {
  const style =
    new URLSearchParams(window.location.search).get("style") || "popup";
  document.body.classList.add(style);

  const btnOpenWindow = document.getElementById("btnOpenWindow");
  if (style === "popup") {
    btnOpenWindow?.classList.remove("d-none");
  }
  btnOpenWindow?.addEventListener("click", () => {
    browser.windows.create({
      url: "/pages/popup.html?style=window",
      type: "popup",
      width: 360,
      height: 600,
    });
  });

  const btnSettings = document.getElementById("btnSettings");
  btnSettings?.addEventListener("click", openSettings);

  const btnMarkEntriesAsRead = document.getElementById("btnMarkEntriesAsRead");
  btnMarkEntriesAsRead?.addEventListener("click", async () => {
    const domIcon = btnMarkEntriesAsRead.getElementsByTagName("span")[0];

    if (domIcon.classList.contains("icon-mark-entries-as-read")) {
      domIcon.classList.remove("icon-mark-entries-as-read");
      domIcon.classList.add("icon-are-you-sure");
      btnMarkEntriesAsRead.classList.add("danger");
      btnMarkEntriesAsRead.title = "Are you sure to mark all entries as read?"; //TODO i18n
    } else {
      try {
        btnMarkEntriesAsRead.disabled = true;
        domIcon.classList.remove("icon-are-you-sure");
        domIcon.classList.add("icon-loading");
        await markEntriesAsRead();

        // Remove entries from cache
        await browser.storage.local.set({ entries: [] });

        // Remove entries from view
        const domEntries = document.querySelector(".entries");
        const entries = domEntries.getElementsByClassName("entry");
        while (entries.length > 0) {
          entries[0].remove();
        }
      } finally {
        domIcon.classList.remove("icon-loading");
        domIcon.classList.remove("icon-are-you-sure");
        domIcon.classList.add("icon-mark-entries-as-read");
        btnMarkEntriesAsRead.classList.remove("danger");
        btnMarkEntriesAsRead.title = "Mark all"; //TODO i18n
        btnMarkEntriesAsRead.disabled = false;
      }
    }
  });

  const btnRefresh = document.getElementById("btnRefresh");
  btnRefresh.addEventListener("click", async () => {
    const domIcon = btnRefresh.getElementsByTagName("span")[0];
    try {
      btnRefresh.disabled = true;
      domIcon?.classList.remove("icon-refresh");
      domIcon?.classList.add("icon-loading");

      return await refreshViewEntries();
    } finally {
      btnRefresh.disabled = false;
      domIcon?.classList.remove("icon-loading");
      domIcon?.classList.add("icon-refresh");
    }
  });

  // Load cached entries on load
  loadCachedEntries();
});
