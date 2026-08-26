(function () {
  const headerActions = document.querySelector(".header-actions");
  if (!headerActions) return;

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "btn ghost search-toggle";
  toggleBtn.setAttribute("aria-label", "Suche öffnen");
  toggleBtn.setAttribute("aria-expanded", "false");
  toggleBtn.textContent = "🔍";
  headerActions.insertBefore(toggleBtn, headerActions.firstChild);

  const overlay = document.createElement("div");
  overlay.className = "search-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="search-panel" role="dialog" aria-modal="true" aria-label="Suche">
      <div class="search-panel-inner">
        <input type="search" class="search-input" placeholder="Seiten und Dokumente durchsuchen…" aria-label="Suchbegriff">
        <button type="button" class="btn ghost search-close" aria-label="Suche schliessen">✕</button>
      </div>
      <ul class="search-results"></ul>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = overlay.querySelector(".search-input");
  const resultsEl = overlay.querySelector(".search-results");
  const closeBtn = overlay.querySelector(".search-close");

  let index = null;
  let indexPromise = null;

  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch("/search-index.json")
        .then((res) => res.json())
        .then((data) => {
          index = data;
          return data;
        })
        .catch(() => {
          index = [];
          return index;
        });
    }
    return indexPromise;
  }

  function openSearch() {
    overlay.hidden = false;
    toggleBtn.setAttribute("aria-expanded", "true");
    loadIndex().then(() => input.focus());
  }

  function closeSearch() {
    overlay.hidden = true;
    toggleBtn.setAttribute("aria-expanded", "false");
    toggleBtn.focus();
  }

  function render(results, query) {
    if (!query) {
      resultsEl.innerHTML = "";
      return;
    }
    if (!results.length) {
      resultsEl.innerHTML = `<li class="search-empty">Keine Treffer für „${escapeHtml(query)}“.</li>`;
      return;
    }
    resultsEl.innerHTML = results
      .slice(0, 25)
      .map(
        (r) => `
        <li>
          <a href="${escapeHtml(r.url)}"${r.type === "PDF" ? ' target="_blank" rel="noopener"' : ""}>
            <span class="search-result-title">${escapeHtml(r.title)}</span>
            <span class="search-result-type">${escapeHtml(r.type)}</span>
          </a>
        </li>`
      )
      .join("");
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function search(query) {
    if (!index) return [];
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return index.filter((entry) => {
      const haystack = entry.title.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }

  toggleBtn.addEventListener("click", () => {
    if (overlay.hidden) openSearch();
    else closeSearch();
  });
  closeBtn.addEventListener("click", closeSearch);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeSearch();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) closeSearch();
  });
  input.addEventListener("input", () => {
    render(search(input.value), input.value.trim());
  });
})();
