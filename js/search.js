(function () {
  const headerActions = document.querySelector(".header-actions");
  if (!headerActions) return;

  const MAX_RESULTS = 25;
  const EXTERNAL_TYPES = ["PDF", "Excel", "Word"];

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
        <input type="search" class="search-input" placeholder="Seiten, Dokumente, Personen, Vereine …" aria-label="Suchbegriff">
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

  // "Zürich" soll auch mit "zurich" gefunden werden
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");

  async function fetchJson(url) {
    try {
      const res = await fetch(url);
      return res.ok ? await res.json() : null;
    } catch (e) {
      return null;
    }
  }

  function loadIndex() {
    if (!indexPromise) {
      indexPromise = (async () => {
        const [staticIndex, results, anmeldungen, events] = await Promise.all([
          fetchJson("/search-index.json"),
          fetchJson("/api/results"),
          fetchJson("/api/anmeldungen"),
          fetchJson("/api/events"),
        ]);
        const all = Array.isArray(staticIndex) ? staticIndex.slice() : [];
        const dateDe = (iso) => String(iso).split("-").reverse().join(".");
        ((results && results.documents) || []).forEach((d) =>
          all.push({
            url: "/result-documents/" + d.filename,
            title: d.title + (d.jahr ? ` (${d.jahr})` : ""),
            type: "PDF",
            keywords: "Resultat Rangliste " + (d.disziplin || ""),
          })
        );
        ((anmeldungen && anmeldungen.anmeldungen) || []).forEach((a) =>
          all.push({
            url: "anmeldung.html#a-" + a.id,
            title: a.title,
            type: "Anmeldung",
            keywords: "online anmelden Wettkampf Formular",
          })
        );
        ((events && events.events) || []).forEach((e) =>
          all.push({
            url: "kalender.html",
            title: `${e.title} – ${dateDe(e.start_date)}`,
            type: "Termin",
            keywords: "Kalender Anlass " + (e.category || "") + " " + (e.location || ""),
          })
        );
        index = all.map((e) => ({ ...e, _title: norm(e.title), _all: norm(e.title + " " + (e.keywords || "")) }));
        return index;
      })();
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

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function render(results, query) {
    if (!query) {
      resultsEl.innerHTML = "";
      return;
    }
    if (!results.length) {
      resultsEl.innerHTML = `<li class="search-empty">Keine Treffer für „${escapeHtml(query)}“. Versuchen Sie einen kürzeren oder anderen Begriff.</li>`;
      return;
    }
    const shown = results.slice(0, MAX_RESULTS);
    resultsEl.innerHTML =
      shown
        .map(
          (r) => `
        <li>
          <a href="${escapeHtml(r.url)}"${EXTERNAL_TYPES.includes(r.type) ? ' target="_blank" rel="noopener"' : ""}>
            <span class="search-result-title">${escapeHtml(r.title)}</span>
            <span class="search-result-type">${escapeHtml(r.type)}</span>
          </a>
        </li>`
        )
        .join("") +
      (results.length > MAX_RESULTS
        ? `<li class="search-empty">… und ${results.length - MAX_RESULTS} weitere Treffer. Bitte den Suchbegriff genauer eingeben.</li>`
        : "");
  }

  function search(query) {
    if (!index) return [];
    const terms = norm(query).trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const hits = index.filter((entry) => terms.every((t) => entry._all.includes(t)));
    // Treffer im Titel zuerst, danach reine Stichwort-Treffer
    return hits.sort(
      (a, b) =>
        Number(terms.every((t) => b._title.includes(t))) - Number(terms.every((t) => a._title.includes(t)))
    );
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
