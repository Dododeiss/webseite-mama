const db = require("./db");

// Prüft bei jeder Anfrage frisch in der Datenbank: Konto muss existieren und freigegeben sein.
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Bitte zuerst anmelden." });
  }
  const user = db
    .prepare("SELECT id, role, approved FROM users WHERE id = ?")
    .get(req.session.userId);
  if (!user || !user.approved) {
    return req.session.destroy(() =>
      res.status(401).json({ error: "Bitte zuerst anmelden." })
    );
  }
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  const user =
    req.user ||
    db.prepare("SELECT role, approved FROM users WHERE id = ?").get(req.session.userId);
  if (!user || !user.approved || user.role !== "admin") {
    return res.status(403).json({ error: "Nur für Administratoren." });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
