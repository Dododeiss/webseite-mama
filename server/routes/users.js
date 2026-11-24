const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../auth");

const router = express.Router();
router.use(requireAuth, requireAdmin);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// ohne verwechselbare Zeichen (0/O, 1/l/I)
const PW_CHARS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function tempPassword() {
  let out = "";
  for (let i = 0; i < 12; i++) out += PW_CHARS[crypto.randomInt(PW_CHARS.length)];
  return out;
}

const COLUMNS = "id, name, email, verein, role, approved, avatar_filename, created_at";

function contentCount(userId) {
  const q = (sql) => db.prepare(sql).get(userId).c;
  return (
    q("SELECT COUNT(*) AS c FROM events WHERE created_by = ?") +
    q("SELECT COUNT(*) AS c FROM anmeldungen WHERE created_by = ?") +
    q("SELECT COUNT(*) AS c FROM result_documents WHERE uploaded_by = ?") +
    q("SELECT COUNT(*) AS c FROM internal_documents WHERE uploaded_by = ?")
  );
}

function adminCount() {
  return db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND approved = 1").get().c;
}

router.get("/", (req, res) => {
  const users = db
    .prepare(`SELECT ${COLUMNS} FROM users ORDER BY approved ASC, role = 'admin' DESC, name COLLATE NOCASE ASC`)
    .all();
  res.json({ users, me: req.session.userId });
});

router.post("/", (req, res) => {
  const { name, email, verein, role } = req.body || {};
  const n = String(name || "").trim();
  const e = String(email || "").trim().toLowerCase();
  const v = String(verein || "").trim();
  if (!n || !e || !v) {
    return res.status(400).json({ error: "Bitte Name, E-Mail und Verein ausfüllen." });
  }
  if (!EMAIL_RE.test(e)) {
    return res.status(400).json({ error: "Ungültige E-Mail-Adresse." });
  }
  if (n.length > 100 || v.length > 120 || e.length > 150) {
    return res.status(400).json({ error: "Ein Feld ist zu lang." });
  }
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(e)) {
    return res.status(409).json({ error: "Für diese E-Mail-Adresse gibt es schon ein Konto." });
  }
  const password = req.body.password ? String(req.body.password) : tempPassword();
  if (password.length < 8) {
    return res.status(400).json({ error: "Das Passwort muss mindestens 8 Zeichen haben." });
  }
  const info = db
    .prepare(
      "INSERT INTO users (name, email, password_hash, verein, role, approved) VALUES (?, ?, ?, ?, ?, 1)"
    )
    .run(n, e, bcrypt.hashSync(password, 10), v, role === "admin" ? "admin" : "member");
  const user = db.prepare(`SELECT ${COLUMNS} FROM users WHERE id = ?`).get(info.lastInsertRowid);
  res.status(201).json({ user, password });
});

router.patch("/:id", (req, res) => {
  const id = Number(req.params.id);
  const target = db.prepare(`SELECT ${COLUMNS} FROM users WHERE id = ?`).get(id);
  if (!target) return res.status(404).json({ error: "Konto nicht gefunden." });
  const { role, approved } = req.body || {};

  if (id === req.session.userId) {
    return res.status(400).json({ error: "Das eigene Konto kann hier nicht geändert werden." });
  }
  if (role !== undefined && role !== "admin" && role !== "member") {
    return res.status(400).json({ error: "Ungültige Rolle." });
  }
  const newRole = role !== undefined ? role : target.role;
  const newApproved = approved !== undefined ? (approved ? 1 : 0) : target.approved;

  const losesAdmin = target.role === "admin" && target.approved && (newRole !== "admin" || !newApproved);
  if (losesAdmin && adminCount() <= 1) {
    return res.status(400).json({ error: "Es muss mindestens ein aktiver Admin übrig bleiben." });
  }
  db.prepare("UPDATE users SET role = ?, approved = ? WHERE id = ?").run(newRole, newApproved, id);
  res.json({ user: db.prepare(`SELECT ${COLUMNS} FROM users WHERE id = ?`).get(id) });
});

router.post("/:id/reset-password", (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare("SELECT id FROM users WHERE id = ?").get(id)) {
    return res.status(404).json({ error: "Konto nicht gefunden." });
  }
  const password = tempPassword();
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(bcrypt.hashSync(password, 10), id);
  res.json({ password });
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const target = db.prepare(`SELECT ${COLUMNS} FROM users WHERE id = ?`).get(id);
  if (!target) return res.status(404).json({ error: "Konto nicht gefunden." });
  if (id === req.session.userId) {
    return res.status(400).json({ error: "Das eigene Konto kann nicht gelöscht werden." });
  }
  // Beim Löschen würden auch die erfassten Termine, Anmeldungen und Dokumente verschwinden.
  if (contentCount(id) > 0) {
    return res.status(409).json({
      error: "Dieses Konto hat Inhalte erfasst (Termine, Anmeldungen oder Dokumente). Bitte stattdessen sperren.",
    });
  }
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  res.json({ ok: true });
});

module.exports = router;
