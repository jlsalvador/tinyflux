/**
 * Time format styles for relative time display.
 */
export const Style = {
	/** Compact format (e.g., "5m", "2h") */
	ExtremeNarrow: "extremeNarrow",
	/** Verbose format (e.g., "5 minutes ago", "2 hours ago") */
	Long: "long",
};

const timeFormatsExtremeNarrow = [
	[1, "1s", "+1s"],
	[1, "%ds", "+%ds"],
	[60, "1m", "+1m"],
	[60, "%dm", "+%dm"],
	[60 * 60, "1h", "+1h"],
	[60 * 60, "%dh", "+%dh"],
	[60 * 60 * 24, "1d", "+1d"],
	[60 * 60 * 24, "%dd", "+%dd"],
	[60 * 60 * 24 * 7, "1w", "+1w"],
	[60 * 60 * 24 * 7, "%dw", "+%dw"],
	[60 * 60 * 24 * 7 * 4, "1M", "+1M"],
	[60 * 60 * 24 * 7 * 4, "%dM", "+%dM"],
	[60 * 60 * 24 * 7 * 4 * 12, "1y", "+1y"],
	[60 * 60 * 24 * 7 * 4 * 12, "%dy", "+%dy"],
	[60 * 60 * 24 * 7 * 4 * 12 * 100, "1c", "+1c"],
	[60 * 60 * 24 * 7 * 4 * 12 * 100, "%dc", "+%dc"],
];

const timeFormatsLong = [
	[1, "1 second ago", "1 second from now"],
	[1, "%d seconds ago", "%d seconds from now"],
	[60, "1 minute ago", "1 minute from now"],
	[60, "%d minutes ago", "%d minutes from now"],
	[60 * 60, "1 hour ago", "1 hour from now"],
	[60 * 60, "%d hours ago", "%d hours from now"],
	[60 * 60 * 24, "yesterday", "tomorrow"],
	[60 * 60 * 24, "%d days ago", "%d days from now"],
	[60 * 60 * 24 * 7, "last week", "next week"],
	[60 * 60 * 24 * 7, "%d weeks ago", "%d weeks from now"],
	[60 * 60 * 24 * 7 * 4, "last month", "next month"],
	[60 * 60 * 24 * 7 * 4, "%d months ago", "%d months from now"],
	[60 * 60 * 24 * 7 * 4 * 12, "last year", "next year"],
	[60 * 60 * 24 * 7 * 4 * 12, "%d years ago", "%d years from now"],
	[60 * 60 * 24 * 7 * 4 * 12 * 100, "last century", "next century"],
	[
		60 * 60 * 24 * 7 * 4 * 12 * 100,
		"%d centuries ago",
		"%d centuries from now",
	],
];

/**
 * Format a timestamp as a relative time string (e.g., "5 minutes ago").
 * @param {string|number|Date} time
 * @param {string} [style=Style.Long] - Use `Style.ExtremeNarrow` for compact format
 * @returns {string}
 */
export function timeAgo(time, style = Style.Long) {
	const timestamp =
		typeof time === "number"
			? time
			: typeof time === "string"
				? +new Date(time)
				: time instanceof Date
					? time.getTime()
					: Date.now();

	if (!Number.isFinite(timestamp)) {
		return "now";
	}

	let seconds = Math.round((Date.now() - timestamp) / 1000);
	if (seconds === 0) {
		return "now";
	}

	const isFuture = seconds < 0;
	if (isFuture) {
		seconds = Math.abs(seconds);
	}

	const timeFormats =
		style === Style.ExtremeNarrow ? timeFormatsExtremeNarrow : timeFormatsLong;

	// The last bucket always matches (its next divisor is Infinity),
	// so this loop always returns.
	for (let i = 0; ; i += 2) {
		const [divisor] = timeFormats[i];
		const nextDivisor = timeFormats[i + 2]?.[0] ?? Infinity;
		const nextDiff = Math.floor(seconds / nextDivisor);

		if (nextDiff >= 1) {
			continue;
		}

		const count = Math.floor(seconds / divisor);
		const template = count <= 1 ? timeFormats[i] : timeFormats[i + 1];
		return template[isFuture ? 2 : 1].replace("%d", String(count));
	}
}
