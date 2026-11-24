(function () {
  var root = document.documentElement;
  var storageKey = "bsvz-theme";
  var toggleButtons = document.querySelectorAll("[data-theme-toggle]");

  function applyTheme(theme) {
    if (theme === "dark" || theme === "light") {
      root.setAttribute("data-theme", theme);
    } else {
      root.removeAttribute("data-theme");
    }
    toggleButtons.forEach(function (btn) {
      var isDark =
        theme === "dark" ||
        (theme !== "light" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      btn.setAttribute("aria-pressed", isDark ? "true" : "false");
      btn.setAttribute(
        "aria-label",
        isDark ? "Zu hellem Design wechseln" : "Zu dunklem Design wechseln"
      );
      btn.title = btn.getAttribute("aria-label");
      btn.textContent = isDark ? "☀️" : "🌙";
    });
  }

  var saved = localStorage.getItem(storageKey);
  applyTheme(saved);

  toggleButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var current =
        root.getAttribute("data-theme") ||
        (window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light");
      var next = current === "dark" ? "light" : "dark";
      localStorage.setItem(storageKey, next);
      applyTheme(next);
    });
  });

  var navToggle = document.querySelector(".nav-toggle");
  var mobileNav = document.querySelector(".mobile-nav");
  if (navToggle && mobileNav) {
    function setNavOpen(isOpen) {
      mobileNav.classList.toggle("open", isOpen);
      document.body.classList.toggle("nav-open", isOpen);
      navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }
    navToggle.addEventListener("click", function () {
      setNavOpen(!mobileNav.classList.contains("open"));
    });
    mobileNav.querySelectorAll(".nav-dropdown").forEach(function (li) {
      var link = li.querySelector(":scope > a");
      if (!link) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sub-toggle";
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-label", link.textContent.trim() + ": Untermenü öffnen oder schliessen");
      btn.addEventListener("click", function () {
        var open = li.classList.toggle("sub-open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
      link.insertAdjacentElement("afterend", btn);
    });
    mobileNav.addEventListener("click", function (event) {
      if (event.target.closest("a")) setNavOpen(false);
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 1180) setNavOpen(false);
    });
  }
})();
