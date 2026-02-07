/* global document */

/**
 * @author PlasmaDan <https://stackoverflow.com/a/39810769>
 * @author José Luis Salvador Rufo <salvador.joseluis@gmail.com>
 */

document.addEventListener("DOMContentLoaded", async () => {
  function replace_i18n(obj, tag, dst = "innerHTML") {
    var msg = tag.replace(/__MSG_(\w+)__/g, function (_match, v1) {
      return v1 ? chrome.i18n.getMessage(v1) : "";
    });

    if (msg != tag) obj[dst] = msg;
  }

  function localizeHtmlPage() {
    // Localize using __MSG_***__ data tags
    var data = document.querySelectorAll(
      "[data-localize],[data-title-localize]",
    );
    for (var i in data)
      if (Object.prototype.hasOwnProperty.call(data, i)) {
        var obj = data[i];
        var tag = obj.getAttribute("data-localize")?.toString();
        if (tag) replace_i18n(obj, tag, "innerHTML");
        var title = obj.getAttribute("data-title-localize")?.toString();
        if (title) replace_i18n(obj, title, "title");
      }

    // // Localize everything else by replacing all __MSG_***__ tags
    // var page = document.getElementsByTagName("html");

    // for (var j = 0; j < page.length; j++) {
    //   var obj = page[j];
    //   var tag = obj.innerHTML.toString();

    //   replace_i18n(obj, tag);
    // }
  }

  localizeHtmlPage();
});
