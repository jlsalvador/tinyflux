/* global document, chrome */

/**
 * @author PlasmaDan <https://stackoverflow.com/a/39810769>
 * @author José Luis Salvador Rufo <salvador.joseluis@gmail.com>
 */

document.addEventListener("DOMContentLoaded", async () => {
  function replace_i18n(obj, tag, dst = "innerHTML") {
    var msg = tag.replace(/__MSG_(\w+)__/g, function (_match, v1) {
      return v1 ? chrome.i18n.getMessage(v1) : "";
    });

    if (msg !== tag) obj[dst] = msg;
  }

  function localizeHtmlPage() {
    // Localize using __MSG_***__ data tags
    var data = document.querySelectorAll(
      "[data-localize],[data-title-localize]",
    );
    data.forEach(function (obj) {
      var tag = obj.getAttribute("data-localize")?.toString();
      if (tag) replace_i18n(obj, tag, "innerHTML");
      var title = obj.getAttribute("data-title-localize")?.toString();
      if (title) replace_i18n(obj, title, "title");
    });
  }

  localizeHtmlPage();
});
