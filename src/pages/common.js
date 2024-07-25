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
 * @property {number} id
 * @property {string} data
 * @property {string} mime_type
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

export const DEFAULT_URL = "";
export const DEFAULT_TOKEN = "";
export const DEFAULT_PERIOD_REFRESH = 15;

/**
 * @typedef {Error}
 */
export const ErrorInvalidUrlOrToken = new Error(
  "You must configure your Miniflux URL and Token"
);

export function openSettings() {
  browser.runtime.openOptionsPage();

  try {
    const style =
      new URLSearchParams(window.location.search).get("style") || "popup";
    if (style === "popup") {
      window.close();
    }
  } catch {}
}

/**
 * This function does a Miniflux API request.
 *
 * The URL and Token will be fetch from `browser.storage.local` if they are not
 * supplied.
 *
 * @param {string} path Example: "/v1/me/"
 * @param {{ url: string; token: string; method: "GET"|"HEAD"|"POST"|"PUT"|"DELETE"|"CONNECT"|"OPTIONS"|"TRACE"|"PATCH"; body: undefined; contentType: string; }} [options]
 * @returns
 * @throws {ErrorInvalidUrlOrToken}
 */
export async function request(
  path,
  options = {
    url: "",
    token: "",
    method: "GET",
    body: undefined,
    contentType: "application/json",
  }
) {
  let url = options?.url || "",
    token = options?.token || "",
    method = options?.method || "GET",
    body = options?.body || undefined,
    contentType = options?.contentType || "application/json";
  if (url === "" || token === "") {
    [url, token] = await browser.storage.local
      .get(["url", "token"])
      .then((data) => {
        return [data.url || "", data.token || ""];
      });
  }

  if (url === "" || token === "") {
    throw ErrorInvalidUrlOrToken;
  }

  return fetch(
    new Request(new URL(path, url), {
      method: method,
      headers: new Headers({
        "X-Auth-Token": token,
        "Content-Type": contentType,
      }),
      body: body,
    })
  );
}

export async function updateBadge() {
  const entries = await browser.storage.local
    .get("entries")
    .then((data) => data.entries || []);
  const counter = entries.length;
  browser.action.setBadgeText({
    text: counter > 0 ? `${counter}` : "0",
  });
}

export async function refreshEntries() {
  // import { testEntries } from "./popup.test.js";
  // for (const entry of testEntries()) {
  //   addEntry(entry);
  // }
  // return;

  return request("/v1/entries?status=unread&order=published_at&direction=desc")
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    })
    .then((data) => data.entries)
    .then(async (entries) => {
      await browser.storage.local.set({ entries: entries });
      await updateBadge(entries.length);
      return entries;
    })
    .catch((error) => {
      if (error === ErrorInvalidUrlOrToken) {
        openSettings();
      } else {
        throw error;
      }
    });
}
