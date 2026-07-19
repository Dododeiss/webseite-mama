function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Bitte zuerst anmelden." });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.session.role !== "admin") {
    return res.status(403).json({ error: "Nur für Administratoren." });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
