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

  function applySession(user) {
    const loginLinks = document.querySelectorAll('[data-auth="login"]');
    const registerLinks = document.querySelectorAll('[data-auth="register"]');

    if (user) {
      loginLinks.forEach((el) => {
        el.textContent = "Meine Resultate";
        el.href = "meine-resultate.html";
      });
      registerLinks.forEach((el) => {
        el.textContent = "Abmelden";
        el.href = "#";
        el.addEventListener("click", async (event) => {
          event.preventDefault();
          await fetch("/api/auth/logout", { method: "POST" });
          window.location.href = "index.html";
        });
      });
    }
  }

  document.addEventListener("DOMContentLoaded", loadSession);
})();
