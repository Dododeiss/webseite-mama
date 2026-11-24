(function () {
  const THIS_YEAR = new Date().getFullYear();

  const TYPEN = {
    pistole: {
      label: "Bezirksmatch Pistole",
      title: (y) => `Bezirksmatch ${y} / Pistole 25 und 50 Meter`,
      contact: { name: "Dalis Marjanovic", email: "dalis.marjanovic@bsvz.ch" },
    },
    "bk-a": {
      label: "Bezirkskonkurrenz Kat. A",
      title: (y) => `Bezirkskonkurrenz ${y} – Kat. A (Freie Waffe und Standardgewehr)`,
      min: 225,
      contact: { name: "Rolf Bäumler", email: "rolf.baeumler@bluewin.ch" },
    },
    "bk-b": {
      label: "Bezirkskonkurrenz Kat. B",
      title: (y) => `Bezirkskonkurrenz ${y} – Kat. B (Sturmgewehr 57/90 und Karabiner)`,
      min: 220,
      contact: { name: "Rolf Bäumler", email: "rolf.baeumler@bluewin.ch" },
    },
    "bk-c": {
      label: "Bezirkskonkurrenz Kat. C",
      title: (y) => `Bezirkskonkurrenz ${y} – Kat. C (Ordonnanzpistole und SPK 25m)`,
      min: 500,
      contact: { name: "Rolf Bäumler", email: "rolf.baeumler@bluewin.ch" },
    },
  };

  function esc(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML.replace(/"/g, "&quot;");
  }

  function isoToDe(iso) {
    const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
  }

  function dbTime(value) {
    const d = new Date(String(value).replace(" ", "T") + "Z");
    return Number.isNaN(d.getTime())
      ? ""
      : d.toLocaleString("de-CH", {
          timeZone: "Europe/Zurich",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
  }

  async function api(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try {
      data = await res.json();
    } catch (e) {}
    return { ok: res.ok, status: res.status, data };
  }

  // ---------- Öffentliches Formular ----------

  function formHtml(a) {
    const common = `
      <div class="form-row">
        <div class="form-field"><label for="f${a.id}-name">Name</label>
          <input type="text" id="f${a.id}-name" name="name" autocomplete="family-name" maxlength="80" required></div>
        <div class="form-field"><label for="f${a.id}-vorname">Vorname</label>
          <input type="text" id="f${a.id}-vorname" name="vorname" autocomplete="given-name" maxlength="80" required></div>
      </div>
      <div class="form-field"><label for="f${a.id}-verein">Verein</label>
        <input type="text" id="f${a.id}-verein" name="verein" maxlength="120" placeholder="z. B. Schützenverein Zürich-Leimbach" required></div>`;

    let specific = "";
    if (a.typ === "pistole") {
      const today = new Date().toISOString().slice(0, 10);
      specific = `
        <div class="form-row">
          <div class="form-field"><label for="f${a.id}-geb">Geburtsdatum</label>
            <input type="date" id="f${a.id}-geb" name="geb_datum" autocomplete="bday" min="1900-01-01" max="${today}" required></div>
          <div class="form-field"><label for="f${a.id}-lizenz">Lizenznummer (optional)</label>
            <input type="text" id="f${a.id}-lizenz" name="lizenz" maxlength="30"></div>
        </div>
        <div class="form-row">
          <div class="form-field"><label for="f${a.id}-email">E-Mail</label>
            <input type="email" id="f${a.id}-email" name="email" autocomplete="email" maxlength="150" required></div>
          <div class="form-field"><label for="f${a.id}-tel">Telefon (optional)</label>
            <input type="tel" id="f${a.id}-tel" name="tel" autocomplete="tel" maxlength="30"></div>
        </div>
        <fieldset class="check-fieldset">
          <legend>Ich melde mich für folgende Disziplinen an</legend>
          <div class="check-list">
            ${a.slots
              .map(
                (s, i) =>
                  `<label class="check-item"><input type="checkbox" name="slots" value="${i}"><span>${esc(s)}</span></label>`
              )
              .join("")}
          </div>
        </fieldset>`;
    } else {
      const min = TYPEN[a.typ] && TYPEN[a.typ].min;
      specific = `
        <div class="form-field form-field-narrow"><label for="f${a.id}-jahrgang">Jahrgang</label>
          <input type="number" id="f${a.id}-jahrgang" name="jahrgang" min="1900" max="${THIS_YEAR}" placeholder="z. B. 1975" inputmode="numeric" required></div>
        <details class="punkte-details">
          <summary>Punktzahlen angeben (optional)</summary>
          ${min ? `<p class="hint">Für diese Kategorie gilt: mindestens ${min} Punkte.</p>` : ""}
          <div class="form-row form-row-3">
            <div class="form-field"><label for="f${a.id}-op">OP</label>
              <input type="text" id="f${a.id}-op" name="op" inputmode="decimal" maxlength="6"></div>
            <div class="form-field"><label for="f${a.id}-fs">FS</label>
              <input type="text" id="f${a.id}-fs" name="fs" inputmode="decimal" maxlength="6"></div>
            <div class="form-field"><label for="f${a.id}-bs">BS</label>
              <input type="text" id="f${a.id}-bs" name="bs" inputmode="decimal" maxlength="6"></div>
          </div>
        </details>`;
    }

    return `
      <form class="anmelde-form" data-id="${a.id}" data-typ="${a.typ}" novalidate>
        <div class="form-message" role="alert"></div>
        ${common}
        ${specific}
        <div class="hp-field" aria-hidden="true">
          <label>Bitte leer lassen <input type="text" name="website" tabindex="-1" autocomplete="off"></label>
        </div>
        <p class="hint">Ihre Angaben werden nur für die Durchführung des Wettkampfs gespeichert und an die verantwortliche Person des BSVZ weitergegeben. Mehr dazu in der <a href="datenschutz.html">Datenschutzerklärung</a>.</p>
        <button type="submit" class="btn primary">Anmeldung absenden</button>
      </form>`;
  }

  function cardHtml(a) {
    const contact = [a.contact_name, a.contact_email].filter(Boolean).join(", ");
    return `
      <article class="card anmeldung-card" id="a-${a.id}">
        <h3>${esc(a.title)}</h3>
        <p class="meta">Anmeldeschluss: <strong>${isoToDe(a.deadline)}</strong> · ${a.anzahl} ${a.anzahl === 1 ? "Anmeldung" : "Anmeldungen"} bisher</p>
        ${a.info ? `<p>${esc(a.info)}</p>` : ""}
        ${contact ? `<p class="meta">Fragen an: ${esc(contact)}</p>` : ""}
        <details class="anmelde-details">
          <summary class="btn primary">Jetzt anmelden</summary>
          <div class="anmelde-body">${formHtml(a)}</div>
        </details>
      </article>`;
  }

  function validateForm(form, typ) {
    const get = (n) => (form.elements[n] ? String(form.elements[n].value).trim() : "");
    if (!get("name") || !get("vorname") || !get("verein")) {
      return "Bitte Name, Vorname und Verein ausfüllen.";
    }
    if (typ === "pistole") {
      if (!get("geb_datum")) return "Bitte das Geburtsdatum angeben.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(get("email"))) return "Bitte eine gültige E-Mail-Adresse angeben.";
      if (!form.querySelectorAll('input[name="slots"]:checked').length) {
        return "Bitte mindestens eine Disziplin ankreuzen.";
      }
    } else {
      const j = Number(get("jahrgang"));
      if (!Number.isInteger(j) || j < 1900 || j > THIS_YEAR) return "Bitte einen gültigen Jahrgang angeben (z. B. 1975).";
    }
    return null;
  }

  function bindForms(root, reload) {
    root.querySelectorAll("form.anmelde-form").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const msg = form.querySelector(".form-message");
        msg.className = "form-message";
        msg.textContent = "";
        const typ = form.dataset.typ;
        const problem = validateForm(form, typ);
        if (problem) {
          msg.className = "form-message error";
          msg.textContent = problem;
          return;
        }
        const body = {};
        ["name", "vorname", "verein", "geb_datum", "email", "tel", "lizenz", "jahrgang", "op", "fs", "bs", "website"].forEach((n) => {
          if (form.elements[n]) body[n] = String(form.elements[n].value).trim();
        });
        if (typ === "pistole") {
          body.slots = [...form.querySelectorAll('input[name="slots"]:checked')].map((c) => Number(c.value));
        }
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        const res = await api("POST", `/api/anmeldungen/${form.dataset.id}/anmelden`, body);
        if (!res.ok) {
          button.disabled = false;
          msg.className = "form-message error";
          msg.textContent = (res.data && res.data.error) || "Die Anmeldung hat nicht geklappt. Bitte später erneut versuchen.";
          return;
        }
        form.outerHTML = `
          <div class="anmelde-success" role="status">
            <h4>Vielen Dank, ${esc(body.vorname)}!</h4>
            <p>Ihre Anmeldung ist eingegangen und wurde in die Anmeldeliste eingetragen.</p>
            <button type="button" class="btn ghost" data-again>Weitere Person anmelden</button>
          </div>`;
        root.querySelector("[data-again]").addEventListener("click", reload);
      });
    });
  }

  async function renderPublic() {
    const list = document.getElementById("anmeldungen-list");
    const res = await api("GET", "/api/anmeldungen");
    if (!res.ok) {
      list.innerHTML = '<p class="meta">Die Anmeldungen konnten nicht geladen werden.</p>';
      return;
    }
    const items = res.data.anmeldungen;
    if (!items.length) {
      list.innerHTML =
        '<div class="card"><p>Zurzeit ist keine Anmeldung offen. Sobald eine Anmeldung für einen Wettkampf freigeschaltet ist, erscheint sie hier.</p></div>';
      return;
    }
    list.innerHTML = items.map(cardHtml).join("");
    bindForms(list, renderPublic);
    const target = location.hash && document.querySelector(location.hash);
    if (target && target.classList.contains("anmeldung-card")) {
      target.querySelector("details").open = true;
      target.scrollIntoView({ behavior: "instant", block: "start" });
    }
  }

  // ---------- Admin ----------

  function participantsTable(a, rows) {
    if (!rows.length) return '<p class="meta">Noch keine Anmeldungen.</p>';
    const isPist = a.typ === "pistole";
    const head = isPist
      ? "<th>Name</th><th>Verein</th><th>Geb. Datum</th><th>Kontakt</th><th>Zeitfenster</th><th>Angemeldet</th><th></th>"
      : "<th>Name</th><th>Verein</th><th>Jahrgang</th><th>OP</th><th>FS</th><th>BS</th><th>Angemeldet</th><th></th>";
    const body = rows
      .map((t) => {
        const del = `<td><button type="button" class="icon-btn" data-del-t="${t.id}">Entfernen</button></td>`;
        const name = `${esc(t.name)} ${esc(t.vorname)}`;
        if (isPist) {
          const slots = t.slots.map((i) => esc(a.slots[i] || "?")).join("<br>");
          const kontakt = [t.email, t.tel, t.lizenz ? "Lizenz " + t.lizenz : ""].filter(Boolean).map(esc).join("<br>");
          return `<tr><td>${name}</td><td>${esc(t.verein)}</td><td>${isoToDe(t.geb_datum)}</td><td>${kontakt}</td><td>${slots}</td><td>${dbTime(t.created_at)}</td>${del}</tr>`;
        }
        const n = (v) => (v === null || v === undefined ? "–" : esc(v));
        return `<tr><td>${name}</td><td>${esc(t.verein)}</td><td>${t.jahrgang || "–"}</td><td>${n(t.op)}</td><td>${n(t.fs)}</td><td>${n(t.bs)}</td><td>${dbTime(t.created_at)}</td>${del}</tr>`;
      })
      .join("");
    return `<div class="table-wrap"><table class="results-table teilnehmer-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  async function renderAdminList() {
    const box = document.getElementById("admin-list");
    const res = await api("GET", "/api/anmeldungen?all=1");
    if (!res.ok) return;
    const items = res.data.anmeldungen;
    if (!items.length) {
      box.innerHTML = '<p class="meta">Noch keine Anmeldungen erstellt.</p>';
      return;
    }
    box.innerHTML = items
      .map(
        (a) => `
      <article class="card admin-anmeldung" data-id="${a.id}">
        <div class="admin-anmeldung-head">
          <div>
            <h3>${esc(a.title)}</h3>
            <p class="meta">${esc(TYPEN[a.typ] ? TYPEN[a.typ].label : a.typ)} · Anmeldeschluss ${isoToDe(a.deadline)}
              <span class="status-chip ${a.is_open ? "is-open" : "is-closed"}">${a.is_open ? "offen" : "geschlossen"}</span></p>
          </div>
          <strong class="anzahl">${a.anzahl} ${a.anzahl === 1 ? "Anmeldung" : "Anmeldungen"}</strong>
        </div>
        <div class="admin-actions">
          <button type="button" class="btn ghost" data-act="show">Anmeldungen ansehen</button>
          <a class="btn primary" href="/api/anmeldungen/${a.id}/export">Liste herunterladen (${a.typ === "pistole" ? "Word" : "Excel"})</a>
          <button type="button" class="btn ghost" data-act="copy">Link kopieren</button>
          <button type="button" class="btn ghost" data-act="clone">Als Vorlage kopieren</button>
          <button type="button" class="icon-btn" data-act="delete">Löschen</button>
        </div>
        <div class="admin-teilnehmer" hidden></div>
      </article>`
      )
      .join("");

    const byId = new Map(items.map((a) => [String(a.id), a]));
    box.querySelectorAll(".admin-anmeldung").forEach((card) => {
      const a = byId.get(card.dataset.id);
      const holder = card.querySelector(".admin-teilnehmer");
      async function loadRows() {
        const r = await api("GET", `/api/anmeldungen/${a.id}/teilnehmer`);
        holder.innerHTML = r.ok ? participantsTable(a, r.data.teilnehmer) : "<p>Konnte nicht geladen werden.</p>";
      }
      card.addEventListener("click", async (event) => {
        const delT = event.target.closest("[data-del-t]");
        if (delT) {
          if (!confirm("Diese Anmeldung wirklich entfernen?")) return;
          await api("DELETE", `/api/anmeldungen/${a.id}/teilnehmer/${delT.dataset.delT}`);
          await loadRows();
          return;
        }
        const act = event.target.closest("[data-act]");
        if (!act) return;
        if (act.dataset.act === "show") {
          holder.hidden = !holder.hidden;
          if (!holder.hidden) await loadRows();
        } else if (act.dataset.act === "copy") {
          const url = `${location.origin}${location.pathname}#a-${a.id}`;
          try {
            await navigator.clipboard.writeText(url);
            act.textContent = "Link kopiert ✓";
          } catch (e) {
            prompt("Link zum Kopieren:", url);
          }
        } else if (act.dataset.act === "clone") {
          const form = document.getElementById("create-form");
          form.elements.typ.value = a.typ;
          form.elements.typ.dispatchEvent(new Event("change"));
          form.elements.title.value = a.title.replace(/\b(?:19|20)\d{2}\b/, (y) => String(Number(y) + 1));
          form.elements.info.value = a.info || "";
          form.elements.contact_name.value = a.contact_name || "";
          form.elements.contact_email.value = a.contact_email || "";
          form.dataset.contactAuto = "0";
          form.elements.slots.value = (a.slots || []).join("\n");
          form.elements.deadline.value = "";
          const m = document.getElementById("create-message");
          m.className = "form-message success";
          m.textContent = "Angaben kopiert. Bitte jetzt Anmeldeschluss (und ggf. Zeitfenster) für das neue Jahr anpassen.";
          form.scrollIntoView({ behavior: "smooth", block: "start" });
          form.elements.deadline.focus({ preventScroll: true });
        } else if (act.dataset.act === "delete") {
          if (!confirm(`„${a.title}“ mit allen ${a.anzahl} Anmeldungen wirklich löschen? Das lässt sich nicht rückgängig machen.`)) return;
          await api("DELETE", `/api/anmeldungen/${a.id}`);
          renderAdminList();
          renderPublic();
        }
      });
    });
  }

  function initAdminForm() {
    const form = document.getElementById("create-form");
    const typSel = form.elements.typ;
    const slotsField = document.getElementById("slots-field");
    let lastSuggestion = "";
    const calBox = document.getElementById("c-cal");
    calBox.addEventListener("change", () => {
      document.getElementById("cal-fields").hidden = !calBox.checked;
    });

    function applyTyp() {
      const t = TYPEN[typSel.value];
      slotsField.hidden = typSel.value !== "pistole";
      if (!t) return;
      const title = form.elements.title;
      if (!title.value.trim() || title.value === lastSuggestion) {
        lastSuggestion = t.title(THIS_YEAR);
        title.value = lastSuggestion;
      }
      if (!form.elements.contact_name.value || form.dataset.contactAuto === "1") {
        form.elements.contact_name.value = t.contact.name;
        form.elements.contact_email.value = t.contact.email;
        form.dataset.contactAuto = "1";
      }
    }
    typSel.addEventListener("change", applyTyp);
    ["contact_name", "contact_email"].forEach((n) =>
      form.elements[n].addEventListener("input", () => (form.dataset.contactAuto = "0"))
    );
    applyTyp();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const msg = document.getElementById("create-message");
      msg.className = "form-message";
      msg.textContent = "";
      const body = {};
      ["typ", "title", "deadline", "info", "contact_name", "contact_email", "slots"].forEach((n) => {
        body[n] = form.elements[n].value;
      });
      if (calBox.checked) {
        if (!document.getElementById("c-cal-start").value) {
          msg.className = "form-message error";
          msg.textContent = "Bitte das Datum des Wettkampfs für den Kalender angeben.";
          return;
        }
        body.kalender = {
          start_date: document.getElementById("c-cal-start").value,
          end_date: document.getElementById("c-cal-end").value,
          location: document.getElementById("c-cal-loc").value,
        };
      }
      const res = await api("POST", "/api/anmeldungen", body);
      if (!res.ok) {
        msg.className = "form-message error";
        msg.textContent = (res.data && res.data.error) || "Speichern fehlgeschlagen.";
        return;
      }
      msg.className = "form-message success";
      msg.textContent =
        "Anmeldung erstellt. Sie ist jetzt öffentlich sichtbar" +
        (res.data.kalender ? " und im Kalender eingetragen." : ".");
      calBox.checked = false;
      document.getElementById("cal-fields").hidden = true;
      ["c-cal-start", "c-cal-end", "c-cal-loc"].forEach((id) => (document.getElementById(id).value = ""));
      form.elements.title.value = "";
      form.elements.deadline.value = "";
      form.elements.info.value = "";
      form.elements.slots.value = "";
      lastSuggestion = "";
      applyTyp();
      renderAdminList();
      renderPublic();
    });
  }

  async function init() {
    renderPublic();
    let isAdmin = false;
    try {
      const me = await (await fetch("/api/auth/me")).json();
      isAdmin = !!(me.user && me.user.role === "admin");
    } catch (e) {}
    if (isAdmin) {
      document.getElementById("admin-area").hidden = false;
      initAdminForm();
      renderAdminList();
    }
  }

  init();
})();
