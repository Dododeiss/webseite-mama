(function () {
  const DISZIPLINEN = [
    "Feldschiessen",
    "Feldstich",
    "Lupi Bezirks-Einzelmatch",
    "Bezirksverbandsschiessen",
    "Bezirkskonkurrenz",
    "Bezirksmatch",
    "Jugend / Nachwuchs",
    "Sonstiges",
  ];

  // Ressort-Tabs zeigen das aktuelle und das letzte Jahr, ältere Jahre erscheinen im Archiv.
  const CURRENT_YEAR = new Date().getFullYear();
  const RESSORT_FROM_YEAR = CURRENT_YEAR - 1;

  const YEAR_HEADING_RE = /^(?:Ranglisten?\s+|Archiv\s+)?(\d{4})\b/;

  function esc(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function isRecent(createdAt) {
    const ageMs = Date.now() - new Date(String(createdAt).replace(" ", "T") + "Z").getTime();
    return ageMs >= 0 && ageMs < 7 * 24 * 60 * 60 * 1000;
  }

  async function fetchDocs() {
    try {
      const res = await fetch("/api/results");
      if (!res.ok) return [];
      return (await res.json()).documents || [];
    } catch (e) {
      return [];
    }
  }

  async function fetchIsAdmin() {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      return !!(data.user && data.user.role === "admin");
    } catch (e) {
      return false;
    }
  }

  function docItem(doc, isAdmin) {
    const li = document.createElement("li");
    li.setAttribute("data-dynamic", "1");
    li.innerHTML =
      `<a href="/result-documents/${esc(doc.filename)}" target="_blank" rel="noopener">${esc(doc.title)}</a>` +
      `<span class="doc-extras">` +
      (isRecent(doc.created_at) ? '<span class="badge-new">Neu</span>' : "") +
      '<span class="doc-ext">PDF</span>' +
      (isAdmin
        ? `<button type="button" class="icon-btn" data-delete-doc="${doc.id}">Löschen</button>`
        : "") +
      `</span>`;
    return li;
  }

  function yearOfCard(card) {
    const h4 = card.querySelector(":scope > h4");
    const m = h4 && h4.textContent.trim().match(YEAR_HEADING_RE);
    return m ? Number(m[1]) : null;
  }

  function newYearCard(year, label) {
    const card = document.createElement("div");
    card.className = "card";
    card.setAttribute("data-dynamic-card", "1");
    card.innerHTML = `<h4>${esc(label || year)}</h4><ul class="doc-list"></ul>`;
    return card;
  }

  // Fügt Dokumente einer Jahres-Karte hinzu: bestehende Karte desselben Jahres erweitern, sonst neue Karte einsortieren.
  function addToYearCards(scope, groups, docs, isAdmin, merge) {
    const byYear = new Map();
    docs.forEach((d) => {
      const key = d.jahr == null ? "none" : d.jahr;
      if (!byYear.has(key)) byYear.set(key, []);
      byYear.get(key).push(d);
    });
    const years = [...byYear.keys()].sort((a, b) => {
      if (a === "none") return -1;
      if (b === "none") return 1;
      return b - a;
    });

    years.forEach((key) => {
      const items = byYear.get(key);
      let card = null;
      if (key !== "none" && merge !== false) {
        card = [...scope.querySelectorAll(".card")].find((c) => yearOfCard(c) === key) || null;
      }
      if (!card) {
        card = newYearCard(key, key === "none" ? "Weitere" : key);
        const cards = [...groups.children];
        const before = cards.find((c) => {
          const y = yearOfCard(c);
          return key === "none" ? true : y !== null && y < key;
        });
        if (before) groups.insertBefore(card, before);
        else groups.appendChild(card);
      }
      const ul = card.querySelector("ul.doc-list");
      items.forEach((d) => ul.appendChild(docItem(d, isAdmin)));
    });
  }

  function clearDynamic(root) {
    root.querySelectorAll("[data-dynamic]").forEach((n) => n.remove());
    root.querySelectorAll("[data-dynamic-card]").forEach((n) => n.remove());
  }

  function suggestTitle(filename) {
    return filename
      .replace(/\.pdf$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function suggestYear(filename) {
    const m = filename.match(/(?:^|[^0-9])((?:19|20)\d{2})(?![0-9])/);
    return m ? Number(m[1]) : CURRENT_YEAR;
  }

  // ---------- Upload-Baustein ----------
  // options: { disziplin?: string (fix) , onUploaded?: () => void }
  function buildUploader(options) {
    const opts = options || {};
    const root = document.createElement("div");
    root.className = "uploader";
    const selectHtml = opts.disziplin
      ? ""
      : `<div class="form-field uploader-discipline">
           <label>Disziplin</label>
           <select data-role="disziplin" aria-label="Disziplin">
             <option value="">Bitte wählen…</option>
             ${DISZIPLINEN.map((d) => `<option value="${esc(d)}">${esc(d)}</option>`).join("")}
           </select>
         </div>`;
    root.innerHTML = `
      ${selectHtml}
      <div class="uploader-drop" data-role="drop" tabindex="0" role="button" aria-label="PDF-Dateien auswählen oder hierher ziehen">
        <strong>PDF-Dateien hierher ziehen</strong>
        <span>oder klicken zum Auswählen – mehrere Dateien auf einmal möglich</span>
      </div>
      <input type="file" accept="application/pdf,.pdf" multiple hidden data-role="input">
      <ul class="uploader-list" data-role="list"></ul>
      <div class="uploader-actions">
        <button type="button" class="btn primary" data-role="submit" disabled>Hochladen</button>
      </div>
      <p class="form-message" role="alert" data-role="message"></p>
    `;

    const drop = root.querySelector('[data-role="drop"]');
    const input = root.querySelector('[data-role="input"]');
    const list = root.querySelector('[data-role="list"]');
    const submit = root.querySelector('[data-role="submit"]');
    const message = root.querySelector('[data-role="message"]');
    const disziplinSelect = root.querySelector('[data-role="disziplin"]');

    let entries = [];

    function setMessage(text, kind) {
      message.className = "form-message" + (kind ? " " + kind : "");
      message.textContent = text || "";
    }

    function render() {
      list.innerHTML = "";
      entries.forEach((entry, i) => {
        const li = document.createElement("li");
        li.className = "uploader-row" + (entry.state ? " is-" + entry.state : "");
        li.innerHTML = `
          <input type="text" class="uploader-title" value="${esc(entry.title)}" aria-label="Titel" ${entry.state === "done" ? "disabled" : ""}>
          <input type="number" class="uploader-year" min="1900" max="2100" value="${entry.year}" aria-label="Jahr" ${entry.state === "done" ? "disabled" : ""}>
          <span class="uploader-status">${esc(entry.status || "")}</span>
          <button type="button" class="icon-btn" aria-label="Entfernen" ${entry.state === "uploading" ? "disabled" : ""}>✕</button>`;
        li.querySelector(".uploader-title").addEventListener("input", (e) => (entry.title = e.target.value));
        li.querySelector(".uploader-year").addEventListener("input", (e) => (entry.year = e.target.value));
        li.querySelector(".icon-btn").addEventListener("click", () => {
          entries.splice(i, 1);
          render();
        });
        list.appendChild(li);
      });
      submit.disabled = !entries.some((e) => e.state !== "done");
    }

    function addFiles(fileList) {
      const files = Array.from(fileList).filter(
        (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name)
      );
      const skipped = fileList.length - files.length;
      files.forEach((file) =>
        entries.push({ file, title: suggestTitle(file.name), year: suggestYear(file.name), status: "", state: "" })
      );
      setMessage(skipped ? `${skipped} Datei(en) übersprungen – nur PDF ist erlaubt.` : "", skipped ? "error" : "");
      render();
    }

    drop.addEventListener("click", () => input.click());
    drop.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        input.click();
      }
    });
    input.addEventListener("change", () => {
      addFiles(input.files);
      input.value = "";
    });
    ["dragenter", "dragover"].forEach((ev) =>
      drop.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.classList.add("is-over");
      })
    );
    ["dragleave", "drop"].forEach((ev) =>
      drop.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.classList.remove("is-over");
      })
    );
    drop.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));

    submit.addEventListener("click", async () => {
      const disziplin = opts.disziplin || (disziplinSelect && disziplinSelect.value);
      if (!disziplin) {
        setMessage("Bitte zuerst eine Disziplin wählen.", "error");
        return;
      }
      const pending = entries.filter((e) => e.state !== "done");
      if (pending.some((e) => !String(e.title).trim())) {
        setMessage("Bitte bei jeder Datei einen Titel eintragen.", "error");
        return;
      }
      setMessage("");
      submit.disabled = true;
      let ok = 0;
      let failed = 0;
      let archived = 0;
      for (const entry of pending) {
        entry.state = "uploading";
        entry.status = "Lädt hoch…";
        render();
        const fd = new FormData();
        fd.append("file", entry.file);
        fd.append("title", String(entry.title).trim());
        fd.append("jahr", entry.year);
        fd.append("disziplin", disziplin);
        try {
          const res = await fetch("/api/results", { method: "POST", body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Fehler");
          entry.state = "done";
          entry.status = "✓ hochgeladen";
          ok++;
          if (Number(entry.year) < RESSORT_FROM_YEAR) archived++;
        } catch (err) {
          entry.state = "error";
          entry.status = err.message;
          failed++;
        }
        render();
      }
      if (ok) {
        let text = `${ok} Datei(en) hochgeladen.`;
        if (archived) {
          text += ` ${archived} davon ${archived === 1 ? "erscheint" : "erscheinen"} wegen des Jahres im Archiv.`;
        }
        setMessage(text, "success");
        entries = entries.filter((e) => e.state !== "done");
        render();
        if (opts.onUploaded) opts.onUploaded();
      }
      if (failed) {
        setMessage(
          (ok ? message.textContent + " " : "") + `${failed} Datei(en) fehlgeschlagen – Fehler stehen in der Liste.`,
          "error"
        );
      }
      submit.disabled = !entries.some((e) => e.state !== "done");
    });

    return root;
  }

  async function deleteDoc(id) {
    const res = await fetch("/api/results/" + id, { method: "DELETE" });
    return res.ok;
  }

  function bindDelete(refresh) {
    document.addEventListener("click", async (event) => {
      const btn = event.target.closest("[data-delete-doc]");
      if (!btn) return;
      if (!confirm("Dieses Dokument wirklich löschen?")) return;
      if (await deleteDoc(btn.getAttribute("data-delete-doc"))) refresh();
    });
  }

  // ---------- Ressorts-Seite ----------
  // map: { sectionId: "Disziplin" }
  async function initRessorts(map) {
    const isAdmin = await fetchIsAdmin();

    // pro Tab: Container + (für Admins) Upload-Feld
    Object.entries(map).forEach(([sectionId, disziplin]) => {
      const section = document.getElementById(sectionId);
      if (!section) return;
      const wrap = document.createElement("div");
      wrap.className = "ressort-uploads";
      wrap.innerHTML = '<div class="doc-groups" data-role="groups"></div>';
      const title = section.querySelector(".section-title");
      title.insertAdjacentElement("afterend", wrap);

      if (isAdmin) {
        const details = document.createElement("details");
        details.className = "upload-box";
        details.innerHTML = `<summary class="btn ghost">＋ Resultat hochladen</summary>`;
        details.appendChild(buildUploader({ disziplin, onUploaded: refresh }));
        wrap.insertBefore(details, wrap.firstChild);
      }
    });

    async function refresh() {
      const docs = await fetchDocs();
      Object.entries(map).forEach(([sectionId, disziplin]) => {
        const section = document.getElementById(sectionId);
        if (!section) return;
        clearDynamic(section);
        const groups = section.querySelector('[data-role="groups"]');
        const visible = docs.filter(
          (d) => d.disziplin === disziplin && (d.jahr == null || d.jahr >= RESSORT_FROM_YEAR)
        );
        if (visible.length) addToYearCards(section, groups, visible, isAdmin, sectionId !== "jugend");
      });
    }

    bindDelete(refresh);
    refresh();
  }

  // ---------- Archiv-Seite ----------
  // blocks: { Disziplin: { id, title } }
  async function initArchiv(blocks) {
    const isAdmin = await fetchIsAdmin();
    const host = document.getElementById("ranglisten-schiessplaene");
    if (!host) return;

    async function refresh() {
      const docs = await fetchDocs();
      host.querySelectorAll("[data-dynamic-block]").forEach((n) => n.remove());
      host.querySelectorAll("[data-dynamic]").forEach((n) => n.remove());
      host.querySelectorAll("[data-dynamic-card]").forEach((n) => n.remove());

      Object.entries(blocks).forEach(([disziplin, cfg]) => {
        const old = docs.filter((d) => d.disziplin === disziplin && d.jahr != null && d.jahr < RESSORT_FROM_YEAR);
        if (!old.length) return;
        let block = document.getElementById(cfg.id);
        if (!block) {
          block = document.createElement("div");
          block.className = "discipline-block";
          block.id = cfg.id;
          block.setAttribute("data-dynamic-block", "1");
          block.innerHTML = `<h3>${esc(cfg.title)}</h3><div class="doc-groups"></div>`;
          host.appendChild(block);
        }
        let groups = block.querySelector(".doc-groups");
        if (!groups) {
          groups = document.createElement("div");
          groups.className = "doc-groups";
          const note = block.querySelector(".empty-note");
          block.insertBefore(groups, note);
        }
        addToYearCards(block, groups, old, isAdmin);
      });
    }

    bindDelete(refresh);
    refresh();
  }

  window.ResultsUI = {
    DISZIPLINEN,
    RESSORT_FROM_YEAR,
    esc,
    isRecent,
    fetchDocs,
    fetchIsAdmin,
    buildUploader,
    bindDelete,
    initRessorts,
    initArchiv,
  };
})();
