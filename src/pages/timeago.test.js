import { TimeAgo, Style } from "./timeago.js";

test('', () => {
    expect(TimeAgo(1, Style.ExtremeNarrow)).ToBe('1s');
});