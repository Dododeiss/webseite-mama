const db = require("./db");

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Bitte zuerst anmelden." });
  }
  next();
}

function requireAdmin(req, res, next) {
  const user = db
    .prepare("SELECT role FROM users WHERE id = ?")
    .get(req.session.userId);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Nur für Administratoren." });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
