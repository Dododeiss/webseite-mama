(function () {
  const jumplist = document.querySelector(".jumplist");
  if (!jumplist) return;

  const links = Array.from(jumplist.querySelectorAll("a[href^='#']"));
  const sections = links
    .map((a) => document.getElementById(a.getAttribute("href").slice(1)))
    .filter(Boolean);
  if (!sections.length) return;

  // Ein Hash kann auf einen Tab selbst oder auf ein Element innerhalb eines Tabs zeigen.
  function resolveHash(hash) {
    const id = hash ? hash.slice(1) : "";
    if (!id) return null;
    const direct = sections.find((s) => s.id === id);
    if (direct) return { sectionId: id, targetId: id };
    const el = document.getElementById(id);
    const container = el && sections.find((s) => s.contains(el));
    return container ? { sectionId: container.id, targetId: id } : null;
  }

  function activate(id, options) {
    const scroll = !options || options.scroll !== false;
    const targetId = (options && options.targetId) || id;
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
      const target = document.getElementById(targetId);
      if (target) {
        const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
      }
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

  const initial = resolveHash(location.hash);
  if (initial) {
    activate(initial.sectionId, { scroll: false });
    if (initial.targetId !== initial.sectionId) {
      const target = document.getElementById(initial.targetId);
      if (target) {
        const jump = () => target.scrollIntoView({ behavior: "instant", block: "start" });
        jump();
        window.addEventListener("load", jump, { once: true });
      }
    }
  } else {
    activate(sections[0].id, { scroll: false });
  }

  window.addEventListener("hashchange", () => {
    const resolved = resolveHash(location.hash);
    if (resolved) {
      activate(resolved.sectionId, { targetId: resolved.targetId });
    }
  });
})();
