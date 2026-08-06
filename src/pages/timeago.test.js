/* global test, expect */

import { TimeAgo, Style } from "./timeago.js";

test("TimeAgo returns 1s for a timestamp 1 second in the past", () => {
  expect(TimeAgo(Date.now() - 1000, Style.ExtremeNarrow)).toBe("1s");
});

test("TimeAgo returns 59s for a timestamp 59 seconds in the past", () => {
  expect(TimeAgo(Date.now() - 59_000, Style.ExtremeNarrow)).toBe("59s");
});

test("TimeAgo returns 1m for a timestamp 1 minute in the past", () => {
  expect(TimeAgo(Date.now() - 60_000, Style.ExtremeNarrow)).toBe("1m");
});

test("TimeAgo returns 2m for a timestamp 2 minutes in the past", () => {
  expect(TimeAgo(Date.now() - 120_000, Style.ExtremeNarrow)).toBe("2m");
});

test("TimeAgo returns 1h for a timestamp 1 hour in the past", () => {
  expect(TimeAgo(Date.now() - 3_600_000, Style.ExtremeNarrow)).toBe("1h");
});

test("TimeAgo returns 1d for a timestamp 1 day in the past", () => {
  expect(TimeAgo(Date.now() - 86_400_000, Style.ExtremeNarrow)).toBe("1d");
});

test("TimeAgo returns 1w for a timestamp 1 week in the past", () => {
  expect(TimeAgo(Date.now() - 604_800_000, Style.ExtremeNarrow)).toBe("1w");
});

test("TimeAgo handles ISO date strings", () => {
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  expect(TimeAgo(oneMinuteAgo, Style.ExtremeNarrow)).toBe("1m");
});

test("TimeAgo handles Date objects", () => {
  expect(TimeAgo(new Date(Date.now() - 60_000), Style.ExtremeNarrow)).toBe(
    "1m",
  );
});

test("TimeAgo Long style returns human-readable format", () => {
  expect(TimeAgo(Date.now() - 1000, Style.Long)).toBe("1 second ago");
});

test("TimeAgo Long style returns plural form", () => {
  expect(TimeAgo(Date.now() - 120_000, Style.Long)).toBe("2 minutes ago");
});

test("TimeAgo returns future format for future dates", () => {
  expect(TimeAgo(Date.now() + 60_000, Style.Long)).toBe("1 minute from now");
});

// --- Additional edge case tests ---

test("TimeAgo returns 2w for a timestamp 2 weeks in the past", () => {
  expect(TimeAgo(Date.now() - 1_209_600_000, Style.ExtremeNarrow)).toBe("2w");
});

test("TimeAgo returns 2M for a timestamp 2 months (~8 weeks) in the past", () => {
  expect(TimeAgo(Date.now() - 4_838_400_000, Style.ExtremeNarrow)).toBe("2M");
});

test("TimeAgo returns 2y for a timestamp 2 years (~96 weeks) in the past", () => {
  expect(TimeAgo(Date.now() - 58_060_800_000, Style.ExtremeNarrow)).toBe("2y");
});

test("TimeAgo returns 2c for a timestamp 2 centuries in the past", () => {
  // 2 centuries = 2 * 100 * 365.25 * 24 * 3600 * 1000 ≈ 6_311_520_000_000 ms
  expect(TimeAgo(Date.now() - 6_311_520_000_000, Style.ExtremeNarrow)).toBe(
    "2c",
  );
});

test("TimeAgo returns 1m for 90 seconds (picks largest unit >= 1)", () => {
  expect(TimeAgo(Date.now() - 90_000, Style.ExtremeNarrow)).toBe("1m");
});

test("TimeAgo returns 2h for 7200 seconds (2 hours, picks hours not minutes)", () => {
  expect(TimeAgo(Date.now() - 7_200_000, Style.ExtremeNarrow)).toBe("2h");
});

test("TimeAgo returns 1d for 90000 seconds (25 hours, picks days not hours)", () => {
  expect(TimeAgo(Date.now() - 90_000_000, Style.ExtremeNarrow)).toBe("1d");
});

test("TimeAgo returns 1M for 30 days (picks months not weeks)", () => {
  expect(TimeAgo(Date.now() - 2_592_000_000, Style.ExtremeNarrow)).toBe("1M");
});

test("TimeAgo Long style returns yesterday for 1 day", () => {
  expect(TimeAgo(Date.now() - 86_400_000, Style.Long)).toBe("yesterday");
});

test("TimeAgo Long style returns tomorrow for future 1 day", () => {
  expect(TimeAgo(Date.now() + 86_400_000, Style.Long)).toBe("tomorrow");
});

test("TimeAgo Long style returns last week for 1 week", () => {
  expect(TimeAgo(Date.now() - 604_800_000, Style.Long)).toBe("last week");
});

test("TimeAgo Long style returns next week for future 1 week", () => {
  expect(TimeAgo(Date.now() + 604_800_000, Style.Long)).toBe("next week");
});

test("TimeAgo Long style returns last month for 1 month (~4 weeks)", () => {
  expect(TimeAgo(Date.now() - 2_419_200_000, Style.Long)).toBe("last month");
});

test("TimeAgo Long style returns last year for 1 year (~48 months)", () => {
  expect(TimeAgo(Date.now() - 31_536_000_000, Style.Long)).toBe("last year");
});

test("TimeAgo ExtremeNarrow returns future format for future dates", () => {
  expect(TimeAgo(Date.now() + 60_000, Style.ExtremeNarrow)).toBe("+1m");
});
