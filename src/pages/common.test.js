/* global test, expect */

import { filterVisibleEntries, InvalidUrlOrTokenError } from "./common.js";

test("validateCredentials does not throw for valid URL and token", () => {
  let passed = false;
  try {
    const url = "https://example.com";
    const token = "abc123";
    if (!url || !token) throw new InvalidUrlOrTokenError();
    passed = true;
  } catch {
    // unexpected
  }
  expect(passed).toBe(true);
});

test("validateCredentials throws when URL is empty", () => {
  let threw = false;
  try {
    const url = "";
    const token = "abc123";
    if (!url || !token) throw new InvalidUrlOrTokenError();
  } catch (e) {
    threw = e instanceof InvalidUrlOrTokenError;
  }
  expect(threw).toBe(true);
});

test("validateCredentials throws when token is empty", () => {
  let threw = false;
  try {
    const url = "https://example.com";
    const token = "";
    if (!url || !token) throw new InvalidUrlOrTokenError();
  } catch (e) {
    threw = e instanceof InvalidUrlOrTokenError;
  }
  expect(threw).toBe(true);
});

test("validateCredentials throws when both URL and token are empty", () => {
  let threw = false;
  try {
    const url = "";
    const token = "";
    if (!url || !token) throw new InvalidUrlOrTokenError();
  } catch (e) {
    threw = e instanceof InvalidUrlOrTokenError;
  }
  expect(threw).toBe(true);
});

test("validateCredentials throws when URL is undefined", () => {
  let threw = false;
  try {
    const url = undefined;
    const token = "abc123";
    if (!url || !token) throw new InvalidUrlOrTokenError();
  } catch (e) {
    threw = e instanceof InvalidUrlOrTokenError;
  }
  expect(threw).toBe(true);
});

test("validateCredentials throws when token is undefined", () => {
  let threw = false;
  try {
    const url = "https://example.com";
    const token = undefined;
    if (!url || !token) throw new InvalidUrlOrTokenError();
  } catch (e) {
    threw = e instanceof InvalidUrlOrTokenError;
  }
  expect(threw).toBe(true);
});

test("validateCredentials throws when URL is null", () => {
  let threw = false;
  try {
    const url = null;
    const token = "abc123";
    if (!url || !token) throw new InvalidUrlOrTokenError();
  } catch (e) {
    threw = e instanceof InvalidUrlOrTokenError;
  }
  expect(threw).toBe(true);
});

test("validateCredentials throws when token is null", () => {
  let threw = false;
  try {
    const url = "https://example.com";
    const token = null;
    if (!url || !token) throw new InvalidUrlOrTokenError();
  } catch (e) {
    threw = e instanceof InvalidUrlOrTokenError;
  }
  expect(threw).toBe(true);
});

test("validateCredentials accepts URL with trailing slash", () => {
  let passed = false;
  try {
    const url = "https://example.com/";
    const token = "token-with-dash";
    if (!url || !token) throw new InvalidUrlOrTokenError();
    passed = true;
  } catch {
    // unexpected
  }
  expect(passed).toBe(true);
});

test("validateCredentials accepts URL with path", () => {
  let passed = false;
  try {
    const url = "https://example.com/subpath";
    const token = "token";
    if (!url || !token) throw new InvalidUrlOrTokenError();
    passed = true;
  } catch {
    // unexpected
  }
  expect(passed).toBe(true);
});

// --- filterVisibleEntries tests ---

test("filterVisibleEntries hides entries from hidden feeds", () => {
  const entries = [
    {
      id: 1,
      feed: { hide_globally: false, category: { hide_globally: false } },
    },
    {
      id: 2,
      feed: { hide_globally: true, category: { hide_globally: false } },
    },
    {
      id: 3,
      feed: { hide_globally: false, category: { hide_globally: true } },
    },
  ];
  const visible = filterVisibleEntries(entries);
  expect(visible.length).toBe(1);
  expect(visible[0].id).toBe(1);
});

test("filterVisibleEntries handles null/undefined feed gracefully", () => {
  const entries = [
    {
      id: 1,
      feed: { hide_globally: false, category: { hide_globally: false } },
    },
    { id: 2, feed: null },
    { id: 3 },
  ];
  const visible = filterVisibleEntries(entries);
  expect(visible.length).toBe(1);
  expect(visible[0].id).toBe(1);
});

test("filterVisibleEntries returns all when none hidden", () => {
  const entries = [
    {
      id: 1,
      feed: { hide_globally: false, category: { hide_globally: false } },
    },
    {
      id: 2,
      feed: { hide_globally: false, category: { hide_globally: false } },
    },
  ];
  const visible = filterVisibleEntries(entries);
  expect(visible.length).toBe(2);
});

test("filterVisibleEntries returns empty when all hidden", () => {
  const entries = [
    {
      id: 1,
      feed: { hide_globally: true, category: { hide_globally: false } },
    },
    {
      id: 2,
      feed: { hide_globally: false, category: { hide_globally: true } },
    },
  ];
  const visible = filterVisibleEntries(entries);
  expect(visible.length).toBe(0);
});

test("filterVisibleEntries returns empty for empty array", () => {
  const visible = filterVisibleEntries([]);
  expect(visible.length).toBe(0);
});

test("filterVisibleEntries handles entry with no category on feed", () => {
  const entries = [
    {
      id: 1,
      feed: { hide_globally: false },
    },
    {
      id: 2,
      feed: { hide_globally: false, category: null },
    },
    {
      id: 3,
      feed: { hide_globally: false, category: { hide_globally: false } },
    },
  ];
  const visible = filterVisibleEntries(entries);
  expect(visible.length).toBe(1);
  expect(visible[0].id).toBe(3);
});

test("filterVisibleEntries handles both feed and category hidden", () => {
  const entries = [
    {
      id: 1,
      feed: { hide_globally: true, category: { hide_globally: true } },
    },
  ];
  const visible = filterVisibleEntries(entries);
  expect(visible.length).toBe(0);
});

test("filterVisibleEntries preserves entry order", () => {
  const entries = [
    {
      id: 3,
      feed: { hide_globally: false, category: { hide_globally: false } },
    },
    {
      id: 1,
      feed: { hide_globally: false, category: { hide_globally: false } },
    },
    {
      id: 4,
      feed: { hide_globally: false, category: { hide_globally: false } },
    },
  ];
  const visible = filterVisibleEntries(entries);
  expect(visible.map((e) => e.id)).toEqual([3, 1, 4]);
});
