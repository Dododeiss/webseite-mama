(function () {
  function esc(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
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
    return { ok: res.ok, data: data || {} };
  }

  function showPassword(name, password, intro) {
    const box = document.getElementById("temp-pw");
    box.innerHTML = `
      <h3>${esc(intro)} <strong>${esc(name)}</strong></h3>
      <p class="temp-pw-code"><code id="pw-code">${esc(password)}</code>
        <button type="button" class="btn ghost" id="pw-copy">Kopieren</button></p>
      <p class="meta">Dieses Passwort wird nur jetzt angezeigt. Bitte persönlich weitergeben –
      die Person kann es danach unter «Profil → Passwort ändern» durch ein eigenes ersetzen.</p>`;
    box.hidden = false;
    box.scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById("pw-copy").addEventListener("click", async (e) => {
      try {
        await navigator.clipboard.writeText(password);
        e.target.textContent = "Kopiert ✓";
      } catch (err) {
        e.target.textContent = "Bitte von Hand kopieren";
      }
    });
  }

  function card(u, me) {
    const isMe = u.id === me;
    const chips = [
      u.role === "admin" ? '<span class="role-chip">Admin</span>' : "",
      !u.approved ? '<span class="status-chip is-closed">wartet / gesperrt</span>' : "",
    ].join(" ");
    const actions = isMe
      ? '<span class="meta">Das bist du</span>'
      : [
          !u.approved
            ? `<button type="button" class="btn primary" data-act="approve">Freigeben</button>`
            : `<button type="button" class="btn ghost" data-act="block">Sperren</button>`,
          u.role === "admin"
            ? `<button type="button" class="btn ghost" data-act="demote">Admin entziehen</button>`
            : `<button type="button" class="btn ghost" data-act="promote">Zum Admin machen</button>`,
          `<button type="button" class="btn ghost" data-act="reset">Passwort zurücksetzen</button>`,
          `<button type="button" class="icon-btn" data-act="delete">Löschen</button>`,
        ].join("");
    return `
      <article class="card user-card${u.approved ? "" : " is-pending"}" data-id="${u.id}" data-name="${esc(u.name)}">
        <div class="user-card-head">
          <div>
            <h3>${esc(u.name)} ${chips}</h3>
            <p class="meta">${esc(u.email)} · ${esc(u.verein)}</p>
          </div>
        </div>
        <div class="admin-actions">${actions}</div>
      </article>`;
  }

  let me = null;

  async function load() {
    const res = await api("GET", "/api/users");
    if (!res.ok) return;
    me = res.data.me;
    const users = res.data.users;
    const pending = users.filter((u) => !u.approved && u.id !== me);
    document.getElementById("pending-section").hidden = pending.length === 0;
    document.getElementById("pending-list").innerHTML = pending.map((u) => card(u, me)).join("");
    document.getElementById("user-list").innerHTML = users.map((u) => card(u, me)).join("");
  }

  async function onAction(event) {
    const btn = event.target.closest("[data-act]");
    if (!btn) return;
    const cardEl = btn.closest(".user-card");
    const id = cardEl.dataset.id;
    const name = cardEl.dataset.name;
    const act = btn.dataset.act;
    let res;
    if (act === "approve") res = await api("PATCH", `/api/users/${id}`, { approved: 1 });
    else if (act === "block") {
      if (!confirm(`„${name}“ sperren? Die Person wird sofort abgemeldet und kann sich nicht mehr anmelden.`)) return;
      res = await api("PATCH", `/api/users/${id}`, { approved: 0 });
    } else if (act === "promote") {
      if (!confirm(`„${name}“ zum Admin machen?`)) return;
      res = await api("PATCH", `/api/users/${id}`, { role: "admin" });
    } else if (act === "demote") {
      if (!confirm(`„${name}“ die Admin-Rechte entziehen?`)) return;
      res = await api("PATCH", `/api/users/${id}`, { role: "member" });
    } else if (act === "reset") {
      if (!confirm(`Neues Passwort für „${name}“ erzeugen? Das alte Passwort wird sofort ungültig.`)) return;
      res = await api("POST", `/api/users/${id}/reset-password`);
      if (res.ok) showPassword(name, res.data.password, "Neues Passwort für");
    } else if (act === "delete") {
      if (!confirm(`„${name}“ endgültig löschen?`)) return;
      res = await api("DELETE", `/api/users/${id}`);
    }
    if (res && !res.ok) alert(res.data.error || "Das hat nicht geklappt.");
    await load();
  }

  async function init() {
    let user = null;
    try {
      user = (await (await fetch("/api/auth/me")).json()).user;
    } catch (e) {}
    if (!user || user.role !== "admin") {
      document.getElementById("not-admin-notice").hidden = false;
      return;
    }
    document.getElementById("admin-area").hidden = false;
    document.getElementById("pending-list").addEventListener("click", onAction);
    document.getElementById("user-list").addEventListener("click", onAction);

    document.getElementById("create-user-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const msg = document.getElementById("create-message");
      msg.className = "form-message";
      msg.textContent = "";
      const body = {
        name: document.getElementById("u-name").value,
        verein: document.getElementById("u-verein").value,
        email: document.getElementById("u-email").value,
        role: document.getElementById("u-admin").checked ? "admin" : "member",
      };
      const res = await api("POST", "/api/users", body);
      if (!res.ok) {
        msg.className = "form-message error";
        msg.textContent = res.data.error || "Das hat nicht geklappt.";
        return;
      }
      event.target.reset();
      showPassword(res.data.user.name, res.data.password, "Konto angelegt für");
      await load();
    });
    load();
  }

  init();
})();
