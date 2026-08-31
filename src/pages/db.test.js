/* global test, expect */

import {
  clearIcons,
  deleteEntries,
  deleteIcons,
  getEntries,
  getIcon,
  listIcons,
  replaceEntries,
  setIcon,
  syncEntries,
  updateEntry,
  insertEntriesIfAbsent,
} from "./db.js";
import { __resetIDB } from "../test/fixtures/indexeddb.js";

// node:test runs this file in its own process, so the db.js module cache and
// the fixture's in-memory store registry start empty. The database is opened
// once and reused across tests; __resetIDB just clears its records between them.
test.beforeEach(() => __resetIDB());

// --- Entries ---------------------------------------------------------------

test("getEntries returns an empty array for a fresh store", async () => {
  expect(await getEntries()).toEqual([]);
});

test("replaceEntries stores every record", async () => {
  await replaceEntries([
    { id: 1, title: "First" },
    { id: 2, title: "Second" },
  ]);
  const entries = await getEntries();
  expect(entries.length).toBe(2);
  expect(entries.map((e) => e.id)).toEqual([1, 2]);
});

test("replaceEntries overwrites the previous set", async () => {
  await replaceEntries([{ id: 1 }, { id: 2 }]);
  await replaceEntries([{ id: 3 }]);
  expect((await getEntries()).map((e) => e.id)).toEqual([3]);
});

test("replaceEntries with an empty list clears the store", async () => {
  await replaceEntries([{ id: 1 }, { id: 2 }]);
  await replaceEntries([]);
  expect(await getEntries()).toEqual([]);
});

test("replaceEntries stores an isolated copy of the input", async () => {
  const entry = { id: 1, tags: ["a"] };
  await replaceEntries([entry]);
  entry.tags.push("mutated");
  const [stored] = await getEntries();
  expect(stored.tags).toEqual(["a"]);
});

test("deleteEntries removes only the given ids", async () => {
  await replaceEntries([{ id: 1 }, { id: 2 }, { id: 3 }]);
  await deleteEntries([2]);
  const ids = (await getEntries()).map((e) => e.id).sort((a, b) => a - b);
  expect(ids).toEqual([1, 3]);
});

test("deleteEntries tolerates unknown ids", async () => {
  await replaceEntries([{ id: 1 }]);
  await deleteEntries([99]);
  expect((await getEntries()).map((e) => e.id)).toEqual([1]);
});

test("insertEntriesIfAbsent inserts missing entries and skips existing ones", async () => {
  await replaceEntries([{ id: 1, title: "orig" }]);
  await insertEntriesIfAbsent([
    { id: 1, title: "new" },
    { id: 2, title: "added" },
  ]);
  const all = await getEntries();
  expect(all.length).toBe(2);
  const byId = Object.fromEntries(all.map((e) => [e.id, e.title]));
  expect(byId[1]).toBe("orig");
  expect(byId[2]).toBe("added");
});

test("updateEntry applies the updater to a single record", async () => {
  await replaceEntries([{ id: 1, title: "A", starred: false }]);
  await updateEntry(1, (entry) => ({ ...entry, starred: true }));
  const [entry] = await getEntries();
  expect(entry.title).toBe("A");
  expect(entry.starred).toBe(true);
});

test("updateEntry leaves the record untouched when the updater returns null", async () => {
  await replaceEntries([{ id: 1, title: "A" }]);
  await updateEntry(1, () => null);
  const [entry] = await getEntries();
  expect(entry.title).toBe("A");
});

test("updateEntry is a no-op for an unknown id", async () => {
  await replaceEntries([]);
  await updateEntry(99, (entry) => ({ ...entry, starred: true }));
  expect((await getEntries()).length).toBe(0);
});

test("syncEntries upserts unread entries and drops read ones", async () => {
  await replaceEntries([
    { id: 1, title: "Old unread" },
    { id: 9, title: "Keep" },
  ]);
  await syncEntries(
    [
      { id: 1, title: "Now read", status: "read" },
      { id: 2, title: "New unread", status: "unread" },
      { id: 9, title: "Keep updated", status: "unread" },
    ],
    100,
  );
  const all = (await getEntries()).sort((a, b) => a.id - b.id);
  expect(all.map((e) => e.id)).toEqual([2, 9]);
  expect(all.find((e) => e.id === 9).title).toBe("Keep updated");
});

test("syncEntries drops archived entries like read ones", async () => {
  await replaceEntries([{ id: 1 }, { id: 2 }]);
  await syncEntries([{ id: 1, status: "archived" }], 100);
  expect((await getEntries()).map((e) => e.id)).toEqual([2]);
});

test("syncEntries with an empty change set keeps the store untouched", async () => {
  await replaceEntries([{ id: 1 }, { id: 2 }]);
  await syncEntries([], 100);
  expect((await getEntries()).map((e) => e.id).sort((a, b) => a - b)).toEqual([
    1, 2,
  ]);
});

test("syncEntries trims the store to the newest maxEntries by published_at", async () => {
  await replaceEntries([
    { id: 1, published_at: "2025-01-01T00:00:00Z" },
    { id: 2, published_at: "2025-01-03T00:00:00Z" },
    { id: 3, published_at: "2025-01-02T00:00:00Z" },
    { id: 4, published_at: "2025-01-04T00:00:00Z" },
  ]);
  await syncEntries(
    [{ id: 5, status: "unread", published_at: "2025-01-05T00:00:00Z" }],
    3,
  );
  // The three newest survive: 5 (Jan 5), 4 (Jan 4), 2 (Jan 3).
  const ids = (await getEntries()).map((e) => e.id).sort((a, b) => a - b);
  expect(ids).toEqual([2, 4, 5]);
});

test("syncEntries does not trim when the store is within the limit", async () => {
  await replaceEntries([
    { id: 1, published_at: "2025-01-01T00:00:00Z" },
    { id: 2, published_at: "2025-01-02T00:00:00Z" },
  ]);
  await syncEntries([], 100);
  expect((await getEntries()).map((e) => e.id).sort((a, b) => a - b)).toEqual([
    1, 2,
  ]);
});

// --- Feed icons ------------------------------------------------------------

test("getIcon returns undefined when the icon is not stored", async () => {
  expect(await getIcon(1)).toBe(undefined);
});

test("setIcon stores the record with the id as key", async () => {
  await setIcon(1, { icon: { data: "x" }, fetchedAt: 1000 });
  const record = await getIcon(1);
  expect(record.id).toBe(1);
  expect(record.icon).toEqual({ data: "x" });
  expect(record.fetchedAt).toBe(1000);
});

test("setIcon replaces an existing record", async () => {
  await setIcon(1, { icon: { data: "old" }, fetchedAt: 1000 });
  await setIcon(1, { icon: { data: "new" }, fetchedAt: 2000 });
  const record = await getIcon(1);
  expect(record.icon).toEqual({ data: "new" });
  expect(record.fetchedAt).toBe(2000);
});

test("listIcons returns every stored icon", async () => {
  await setIcon(1, { icon: { data: "a" } });
  await setIcon(2, { icon: { data: "b" } });
  expect((await listIcons()).length).toBe(2);
});

test("deleteIcons removes only the given ids", async () => {
  await setIcon(1, {});
  await setIcon(2, {});
  await setIcon(3, {});
  await deleteIcons([2]);
  const ids = (await listIcons()).map((i) => i.id).sort((a, b) => a - b);
  expect(ids).toEqual([1, 3]);
});

test("clearIcons empties the icon store", async () => {
  await setIcon(1, {});
  await setIcon(2, {});
  await clearIcons();
  expect((await listIcons()).length).toBe(0);
});
