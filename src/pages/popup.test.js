/* global test, expect */

/**
 * Filter visible entries (duplicated from common.js for testing,
 * since common.js depends on webextension-polyfill which cannot run in Node)
 */
const filterVisibleEntries = (entries) => {
  return entries
    .filter((entry) => entry?.feed && !entry.feed.hide_globally)
    .filter(
      (entry) => entry?.feed?.category && !entry.feed.category.hide_globally,
    );
};

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

// --- Additional edge case tests ---

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
