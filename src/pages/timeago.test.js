import { Style, timeAgo } from "./timeago.js";

test("timeAgo returns 1s for a timestamp 1 second in the past", () => {
	expect(timeAgo(Date.now() - 1000, Style.ExtremeNarrow)).toBe("1s");
});

test("timeAgo returns 59s for a timestamp 59 seconds in the past", () => {
	expect(timeAgo(Date.now() - 59_000, Style.ExtremeNarrow)).toBe("59s");
});

test("timeAgo returns 1m for a timestamp 1 minute in the past", () => {
	expect(timeAgo(Date.now() - 60_000, Style.ExtremeNarrow)).toBe("1m");
});

test("timeAgo returns 2m for a timestamp 2 minutes in the past", () => {
	expect(timeAgo(Date.now() - 120_000, Style.ExtremeNarrow)).toBe("2m");
});

test("timeAgo returns 1h for a timestamp 1 hour in the past", () => {
	expect(timeAgo(Date.now() - 3_600_000, Style.ExtremeNarrow)).toBe("1h");
});

test("timeAgo returns 1d for a timestamp 1 day in the past", () => {
	expect(timeAgo(Date.now() - 86_400_000, Style.ExtremeNarrow)).toBe("1d");
});

test("timeAgo returns 1w for a timestamp 1 week in the past", () => {
	expect(timeAgo(Date.now() - 604_800_000, Style.ExtremeNarrow)).toBe("1w");
});

test("timeAgo handles ISO date strings", () => {
	const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
	expect(timeAgo(oneMinuteAgo, Style.ExtremeNarrow)).toBe("1m");
});

test("timeAgo handles Date objects", () => {
	expect(timeAgo(new Date(Date.now() - 60_000), Style.ExtremeNarrow)).toBe(
		"1m",
	);
});

test("timeAgo Long style returns human-readable format", () => {
	expect(timeAgo(Date.now() - 1000, Style.Long)).toBe("1 second ago");
});

test("timeAgo Long style returns plural form", () => {
	expect(timeAgo(Date.now() - 120_000, Style.Long)).toBe("2 minutes ago");
});

test("timeAgo returns future format for future dates", () => {
	expect(timeAgo(Date.now() + 60_000, Style.Long)).toBe("1 minute from now");
});

// --- Additional edge case tests ---

test("timeAgo returns 2w for a timestamp 2 weeks in the past", () => {
	expect(timeAgo(Date.now() - 1_209_600_000, Style.ExtremeNarrow)).toBe("2w");
});

test("timeAgo returns 2M for a timestamp 2 months (~8 weeks) in the past", () => {
	expect(timeAgo(Date.now() - 4_838_400_000, Style.ExtremeNarrow)).toBe("2M");
});

test("timeAgo returns 2y for a timestamp 2 years (~96 weeks) in the past", () => {
	expect(timeAgo(Date.now() - 58_060_800_000, Style.ExtremeNarrow)).toBe("2y");
});

test("timeAgo returns 2c for a timestamp 2 centuries in the past", () => {
	// 2 centuries = 2 * 100 * 365.25 * 24 * 3600 * 1000 ≈ 6_311_520_000_000 ms
	expect(timeAgo(Date.now() - 6_311_520_000_000, Style.ExtremeNarrow)).toBe(
		"2c",
	);
});

test("timeAgo returns 1m for 90 seconds (picks largest unit >= 1)", () => {
	expect(timeAgo(Date.now() - 90_000, Style.ExtremeNarrow)).toBe("1m");
});

test("timeAgo returns 2h for 7200 seconds (2 hours, picks hours not minutes)", () => {
	expect(timeAgo(Date.now() - 7_200_000, Style.ExtremeNarrow)).toBe("2h");
});

test("timeAgo returns 1d for 90000 seconds (25 hours, picks days not hours)", () => {
	expect(timeAgo(Date.now() - 90_000_000, Style.ExtremeNarrow)).toBe("1d");
});

test("timeAgo returns 1M for 30 days (picks months not weeks)", () => {
	expect(timeAgo(Date.now() - 2_592_000_000, Style.ExtremeNarrow)).toBe("1M");
});

test("timeAgo Long style returns yesterday for 1 day", () => {
	expect(timeAgo(Date.now() - 86_400_000, Style.Long)).toBe("yesterday");
});

test("timeAgo Long style returns tomorrow for future 1 day", () => {
	expect(timeAgo(Date.now() + 86_400_000, Style.Long)).toBe("tomorrow");
});

test("timeAgo Long style returns last week for 1 week", () => {
	expect(timeAgo(Date.now() - 604_800_000, Style.Long)).toBe("last week");
});

test("timeAgo Long style returns next week for future 1 week", () => {
	expect(timeAgo(Date.now() + 604_800_000, Style.Long)).toBe("next week");
});

test("timeAgo Long style returns last month for 1 month (~4 weeks)", () => {
	expect(timeAgo(Date.now() - 2_419_200_000, Style.Long)).toBe("last month");
});

test("timeAgo Long style returns last year for 1 year (~48 months)", () => {
	expect(timeAgo(Date.now() - 31_536_000_000, Style.Long)).toBe("last year");
});

test("timeAgo ExtremeNarrow returns future format for future dates", () => {
	expect(timeAgo(Date.now() + 60_000, Style.ExtremeNarrow)).toBe("+1m");
});
