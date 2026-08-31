import { __resetIDB } from "../test/fixtures/indexeddb.js";
import {
	handleMessage,
	handleStartup,
	markEntriesAsRead,
	toggleBookmark,
} from "./background.js";
import {
	MESSAGE_MARK_ENTRY_IDS_AS_READ,
	MESSAGE_TOGGLE_ENTRY_BOOKMARK,
} from "./common.js";
import { getEntries, replaceEntries } from "./db.js";

// Entries and icons live in IndexedDB now, so clear the in-memory store
// before every test. node:test runs each file in its own process, so the
// db.js module cache and the fixture's store registry start fresh per file.
test.beforeEach(() => __resetIDB());

const testEntries = [
	{ id: 1, title: "Entry 1", starred: false },
	{ id: 2, title: "Entry 2", starred: true },
	{ id: 3, title: "Entry 3", starred: false },
];

const okFetch = () =>
	Promise.resolve({
		ok: true,
		status: 200,
		json: () => Promise.resolve({}),
		text: () => Promise.resolve(""),
	});

const failFetch = () => Promise.reject(new Error("API error"));

// Mock the Miniflux credentials (read by minifluxRequest()) and fetch for the duration
// of a test; node:test restores the originals automatically when the test ends.
const mockApi = (t, fetchMock) => {
	t.mock.method(browser.storage.local, "get", () =>
		Promise.resolve({
			url: "https://miniflux.example.com",
			token: "test-api-token",
		}),
	);
	t.mock.method(globalThis, "fetch", fetchMock);
};

const idsOf = (entries) => entries.map((e) => e.id).sort((a, b) => a - b);

// --- handleMessage tests ---

test("handleMessage routes mark entries as read message", async (t) => {
	mockApi(t, okFetch);
	await replaceEntries(testEntries);

	const result = await handleMessage({
		action: MESSAGE_MARK_ENTRY_IDS_AS_READ,
		entryIds: [1, 2],
	});
	expect(result).toBeTruthy();
});

test("handleMessage routes toggle bookmark message", async (t) => {
	mockApi(t, okFetch);
	await replaceEntries(testEntries);

	const result = await handleMessage({
		action: MESSAGE_TOGGLE_ENTRY_BOOKMARK,
		entryId: 1,
	});
	expect(result).toBeTruthy();
});

test("handleMessage returns false for unknown message", async () => {
	const result = await handleMessage({ action: "unknown_action" });
	expect(result).toBe(false);
});

test("handleMessage returns false when entryIds is missing", async (t) => {
	mockApi(t, okFetch);
	await replaceEntries(testEntries);

	const result = await handleMessage({
		action: MESSAGE_MARK_ENTRY_IDS_AS_READ,
	});
	expect(result).toBe(false);
	expect((await getEntries()).length).toBe(3);
});

test("handleMessage returns false when entryId is not a number", async (t) => {
	mockApi(t, okFetch);
	await replaceEntries(testEntries);

	const result = await handleMessage({
		action: MESSAGE_TOGGLE_ENTRY_BOOKMARK,
		entryId: "1",
	});
	expect(result).toBe(false);
	expect((await getEntries()).length).toBe(3);
});

// --- markEntriesAsRead tests ---

test("markEntriesAsRead removes entries from the store optimistically", async (t) => {
	mockApi(t, okFetch);
	await replaceEntries(testEntries);

	const result = await markEntriesAsRead([1, 2]);
	expect(result.length).toBe(1);
	expect(result[0].id).toBe(3);
	expect(idsOf(await getEntries())).toEqual([3]);
});

test("markEntriesAsRead reverts on API failure", async (t) => {
	mockApi(t, failFetch);
	await replaceEntries(testEntries);

	let caughtError = null;
	try {
		await markEntriesAsRead([1, 2]);
	} catch (error) {
		caughtError = error;
	}
	expect(caughtError).toBeTruthy();
	expect(caughtError.message).toBe("Failed to mark entries as read, reverting");
	expect(caughtError.cause.message).toBe("API error");
	// The optimistic deletion was rolled back.
	expect(idsOf(await getEntries())).toEqual([1, 2, 3]);
});

test("markEntriesAsRead is a no-op for empty entry IDs", async (t) => {
	let fetched = false;
	mockApi(t, () => {
		fetched = true;
		return okFetch();
	});
	await replaceEntries(testEntries);

	const result = await markEntriesAsRead([]);
	expect(result).toBe(undefined);
	expect(fetched).toBe(false);
	expect((await getEntries()).length).toBe(3);
});

test("markEntriesAsRead is a no-op for non-array entry IDs", async (t) => {
	mockApi(t, okFetch);
	await replaceEntries(testEntries);

	const result = await markEntriesAsRead("not-an-array");
	expect(result).toBe(undefined);
	expect((await getEntries()).length).toBe(3);
});

test("markEntriesAsRead handles missing entries in the store", async (t) => {
	mockApi(t, okFetch);
	// Empty store.

	const result = await markEntriesAsRead([1]);
	expect(result.length).toBe(0);
});

test("markEntriesAsRead marks a single entry as read", async (t) => {
	mockApi(t, okFetch);
	await replaceEntries(testEntries);

	const result = await markEntriesAsRead([2]);
	expect(result.length).toBe(2);
	expect(idsOf(result)).toEqual([1, 3]);
	expect(idsOf(await getEntries())).toEqual([1, 3]);
});

// --- toggleBookmark tests ---

test("toggleBookmark toggles starred status from false to true", async (t) => {
	mockApi(t, okFetch);
	await replaceEntries(testEntries);

	const result = await toggleBookmark(1);
	const entry1 = result.find((e) => e.id === 1);
	expect(entry1.starred).toBe(true);
});

test("toggleBookmark toggles starred status from true to false", async (t) => {
	mockApi(t, okFetch);
	await replaceEntries(testEntries);

	const result = await toggleBookmark(2);
	const entry2 = result.find((e) => e.id === 2);
	expect(entry2.starred).toBe(false);
});

test("toggleBookmark does nothing for a non-existent entry", async (t) => {
	mockApi(t, okFetch);
	await replaceEntries(testEntries);

	const result = await toggleBookmark(999);
	expect(result).toBeFalsy();
	// No entry changed.
	expect(idsOf(await getEntries())).toEqual([1, 2, 3]);
	const entry1 = (await getEntries()).find((e) => e.id === 1);
	expect(entry1.starred).toBe(false);
});

test("toggleBookmark preserves other entries unchanged", async (t) => {
	mockApi(t, okFetch);
	await replaceEntries(testEntries);

	const result = await toggleBookmark(1);
	const entry2 = result.find((e) => e.id === 2);
	expect(entry2.starred).toBe(true);
	const entry3 = result.find((e) => e.id === 3);
	expect(entry3.starred).toBe(false);
});

test("toggleBookmark handles a missing entry in the store", async (t) => {
	mockApi(t, okFetch);
	// Empty store.

	const result = await toggleBookmark(1);
	expect(result).toBeFalsy();
});

test("toggleBookmark reverts on API failure", async (t) => {
	mockApi(t, failFetch);
	await replaceEntries(testEntries);

	let caughtError = null;
	try {
		await toggleBookmark(1);
	} catch (error) {
		caughtError = error;
	}
	expect(caughtError).toBeTruthy();
	expect(caughtError.message).toBe("Failed to toggle bookmark, reverting");
	expect(caughtError.cause.message).toBe("API error");
	const revertedEntry = (await getEntries()).find((e) => e.id === 1);
	expect(revertedEntry.starred).toBe(false);
});

// --- handleStartup tests ---

test("handleStartup opens settings silently when credentials are missing", async (t) => {
	t.mock.method(console, "log", () => {});
	let settingsOpened = false;
	t.mock.method(browser.storage.local, "get", () =>
		Promise.resolve({
			url: "",
			token: "",
		}),
	);
	t.mock.method(browser.runtime, "openOptionsPage", () => {
		settingsOpened = true;
		return Promise.resolve();
	});
	resetDOM("<!doctype html><html><head></head><body></body></html>");

	await handleStartup();
	expect(settingsOpened).toBe(true);
});

test("handleStartup logs non-credential errors without throwing", async (t) => {
	t.mock.method(console, "log", () => {});
	const errors = [];
	t.mock.method(console, "error", (...args) => {
		errors.push(args);
	});
	t.mock.method(browser.storage.local, "get", () => Promise.resolve({}));
	t.mock.method(browser.action, "setPopup", () => {
		throw new Error("unexpected action error");
	});

	let threw = false;
	try {
		await handleStartup();
	} catch {
		threw = true;
	}

	expect(threw).toBe(false);
	expect(errors.length).toBe(1);
	expect(String(errors[0][1])).toContain("unexpected action error");
});

test("handleStartup removes legacy storage keys and the stale refresh alarm", async (t) => {
	t.mock.method(console, "log", () => {});
	t.mock.method(console, "error", () => {});
	const removedKeys = [];
	t.mock.method(browser.storage.local, "getKeys", () =>
		Promise.resolve(["entries", "icon123", "url", "token"]),
	);
	t.mock.method(browser.storage.local, "remove", (keys) => {
		removedKeys.push(...keys);
		return Promise.resolve();
	});
	const clearedAlarms = [];
	t.mock.method(browser.alarms, "clear", (name) => {
		clearedAlarms.push(name);
		return Promise.resolve(true);
	});
	t.mock.method(browser.storage.local, "get", () =>
		Promise.resolve({
			url: "",
			token: "",
		}),
	);
	t.mock.method(browser.runtime, "openOptionsPage", () => Promise.resolve());
	resetDOM("<!doctype html><html><head></head><body></body></html>");

	await handleStartup();

	// Only the legacy keys are removed; current settings keys are kept.
	expect(removedKeys).toEqual(["entries", "icon123"]);
	expect(clearedAlarms).toEqual(["ALARM_REFRESH"]);
});
