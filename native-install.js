(() => {
  const originalAddEventListener = EventTarget.prototype.addEventListener;

  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (this === window && type === "beforeinstallprompt") return;
    return originalAddEventListener.call(this, type, listener, options);
  };

  const style = document.createElement("style");
  style.textContent = `
    #installBanner,
    #installButton,
    #installHelpDialog {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
})();
