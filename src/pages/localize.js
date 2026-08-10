/* global document, chrome */

/**
 * @author PlasmaDan <https://stackoverflow.com/a/39810769>
 * @author José Luis Salvador Rufo <salvador.joseluis@gmail.com>
 */

document.addEventListener("DOMContentLoaded", async () => {
  /**
   * Replace __MSG_*__ placeholders in a string with i18n messages.
   * @param {HTMLElement} obj
   * @param {string} tag
   * @param {string} [dst="innerHTML"]
   */
  const replaceI18n = (obj, tag, dst = "innerHTML") => {
    const msg = tag.replace(/__MSG_(\w+)__/g, (_match, v1) =>
      v1 ? chrome.i18n.getMessage(v1) : "",
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
