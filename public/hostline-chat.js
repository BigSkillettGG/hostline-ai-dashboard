(function () {
  const current = document.currentScript;
  if (!current) return;

  const next = document.createElement("script");
  for (const attribute of current.attributes) {
    if (attribute.name !== "src") {
      next.setAttribute(attribute.name, attribute.value);
    }
  }
  next.src = new URL("signalhost-chat.js", current.src).href;
  next.async = true;
  current.parentNode?.insertBefore(next, current.nextSibling);
})();
