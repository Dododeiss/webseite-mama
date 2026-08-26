(function () {
  const jumplist = document.querySelector(".jumplist");
  if (!jumplist) return;

  const links = Array.from(jumplist.querySelectorAll("a[href^='#']"));
  const sections = links
    .map((a) => document.getElementById(a.getAttribute("href").slice(1)))
    .filter(Boolean);
  if (!sections.length) return;

  function activate(id, options) {
    const scroll = !options || options.scroll !== false;
    sections.forEach((section) => {
      section.style.display = section.id === id ? "" : "none";
    });
    links.forEach((a) => {
      const isActive = a.getAttribute("href") === "#" + id;
      a.classList.toggle("active", isActive);
      if (isActive) {
        a.setAttribute("aria-current", "true");
      } else {
        a.removeAttribute("aria-current");
      }
    });
    if (scroll) {
      const target = document.getElementById(id);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  links.forEach((a) => {
    a.addEventListener("click", (event) => {
      event.preventDefault();
      const id = a.getAttribute("href").slice(1);
      history.replaceState(null, "", "#" + id);
      activate(id);
    });
  });

  const hashId = location.hash ? location.hash.slice(1) : "";
  const initialId = sections.some((s) => s.id === hashId) ? hashId : sections[0].id;
  activate(initialId, { scroll: false });

  window.addEventListener("hashchange", () => {
    const id = location.hash.slice(1);
    if (sections.some((s) => s.id === id)) {
      activate(id);
    }
  });
})();
