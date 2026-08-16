(function () {
  async function loadSession() {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return;
      const data = await res.json();
      applySession(data.user);
    } catch (e) {
      // Backend not running (e.g. plain static file preview) – leave header as-is.
    }
  }

  function initials(name) {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    return parts
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase();
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function buildProfileWidget(user) {
    const wrap = document.createElement("div");
    wrap.className = "profile-widget";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "profile-widget-btn";
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");

    const avatar = document.createElement("span");
    avatar.className = "profile-avatar";
    if (user.avatar_filename) {
      avatar.innerHTML = `<img src="/avatars/${escapeHtml(user.avatar_filename)}" alt="">`;
    } else {
      avatar.textContent = initials(user.name);
    }
    btn.appendChild(avatar);

    const nameSpan = document.createElement("span");
    nameSpan.className = "profile-widget-name";
    nameSpan.textContent = user.name;
    btn.appendChild(nameSpan);

    const menu = document.createElement("div");
    menu.className = "profile-dropdown-menu";
    menu.hidden = true;
    menu.innerHTML = `
      <a href="profil.html">👤 Profil</a>
      <a href="meine-resultate.html">🏆 Meine Resultate</a>
      <button type="button" class="profile-logout">↪ Abmelden</button>
    `;

    function closeMenu() {
      menu.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }

    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = menu.hidden;
      menu.hidden = !willOpen;
      btn.setAttribute("aria-expanded", String(willOpen));
    });
    document.addEventListener("click", (event) => {
      if (!wrap.contains(event.target)) closeMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
    menu.querySelector(".profile-logout").addEventListener("click", async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "index.html";
    });

    wrap.appendChild(btn);
    wrap.appendChild(menu);
    return wrap;
  }

  function applySession(user) {
    const loginLinks = document.querySelectorAll('[data-auth="login"]');

    if (!user) return;

    loginLinks.forEach((el) => {
      el.style.display = "none";
    });

    document.querySelectorAll(".header-actions").forEach((container) => {
      if (container.querySelector(".profile-widget")) return;
      const navToggle = container.querySelector(".nav-toggle");
      container.insertBefore(buildProfileWidget(user), navToggle);
    });
  }

  document.addEventListener("DOMContentLoaded", loadSession);
})();
