/**
 * @typedef {Object} Style
 * @property {string} ExtremeNarrow
 * @property {string} Long
 */
export const Style = {
  ExtremeNarrow: "extremeNarrow",
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
 * @param {string|number|Date} time
 * @param {string} [style=Style.Long]
 * @returns
 */
export function TimeAgo(time, style = Style.Long) {
  switch (typeof time) {
    case "number":
      break;
    case "string":
      time = +new Date(time);
      break;
    case "object":
      if (time.constructor === Date) time = time.getTime();
      break;
    default:
      time = +new Date();
  }

  let seconds = (+new Date() - time) / 1000;

  let pastOrFuture = 1; //1 = past, 2 = future
  if (seconds < 0) {
    seconds = Math.abs(seconds);
    pastOrFuture = 2;
  }

  let timeFormats;
  switch (style) {
    case Style.ExtremeNarrow:
      timeFormats = timeFormatsExtremeNarrow;
      break;
    default:
      timeFormats = timeFormatsLong;
  }

  let i = 0;
  let result;

  while (i < timeFormats.length - 1) {
    const [divisor, ,] = timeFormats[i];
    const nextDivisor = timeFormats[i + 2]?.[0] ?? Infinity;
    const nextDiff = Math.floor(seconds / nextDivisor);

    if (nextDiff >= 1) {
      i += 2;
      continue;
    }

    const count = Math.floor(seconds / divisor);
    const template = count <= 1 ? timeFormats[i] : timeFormats[i + 1];
    result = template[pastOrFuture].replace("%d", count);
    break;
  }

  if (!result) {
    const d = timeFormats[i]?.[0] ?? 1;
    const count = Math.floor(seconds / d);
    result = timeFormats[i][pastOrFuture].replace("%d", count);
  }

  return result;
}
