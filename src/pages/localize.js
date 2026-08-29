/* global document, chrome, console */

/**
 * @author PlasmaDan <https://stackoverflow.com/a/39810769>
 * @author José Luis Salvador Rufo <salvador.joseluis@gmail.com>
 */

document.addEventListener("DOMContentLoaded", async () => {
  /**
   * Replace __MSG_*__ placeholders in a string with i18n messages.
   * If any referenced message is missing, the element keeps its fallback
   * text and a warning is logged (a missing message is a translation/build
   * error, not something to fix silently at runtime).
   * @param {HTMLElement} obj
   * @param {string} tag
   * @param {string} [dst="innerHTML"]
   */
  const replaceI18n = (obj, tag, dst = "innerHTML") => {
    const keys = [...tag.matchAll(/__MSG_(\w+)__/g)].map((match) => match[1]);
    const missing = [
      ...new Set(keys.filter((key) => !chrome.i18n.getMessage(key))),
    ];

    if (missing.length > 0) {
      console.warn(
        `[localize] Missing i18n message(s): ${missing.join(", ")}. ` +
          "Keeping the element's fallback text.",
        obj,
      );
      return;
    }

    const msg = tag.replace(/__MSG_(\w+)__/g, (_match, key) =>
      chrome.i18n.getMessage(key),
    );

    if (msg !== tag) obj[dst] = msg;
  };

  /**
   * Localize elements using __MSG_***__ data attributes.
   */
  const localizeHtmlPage = () => {
    const elements = document.querySelectorAll(
      "[data-localize],[data-title-localize]",
    );
    elements.forEach((obj) => {
      const tag = obj.getAttribute("data-localize")?.toString();
      if (tag) replaceI18n(obj, tag, "innerHTML");
      const title = obj.getAttribute("data-title-localize")?.toString();
      if (title) replaceI18n(obj, title, "title");
    });
  };

  localizeHtmlPage();
});
