const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/register", (req, res) => {
  const { name, email, verein, password } = req.body || {};

  if (!name || !email || !verein || !password) {
    return res.status(400).json({ error: "Bitte alle Felder ausfüllen." });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "Ungültige E-Mail-Adresse." });
  }
  if (String(password).length < 8) {
    return res
      .status(400)
      .json({ error: "Das Passwort muss mindestens 8 Zeichen haben." });
  }

  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(email.toLowerCase().trim());
  if (existing) {
    return res
      .status(409)
      .json({ error: "Für diese E-Mail-Adresse existiert bereits ein Konto." });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(
      "INSERT INTO users (name, email, password_hash, verein) VALUES (?, ?, ?, ?)"
    )
    .run(name.trim(), email.toLowerCase().trim(), passwordHash, verein.trim());

  req.session.userId = info.lastInsertRowid;
  req.session.role = "member";
  res.status(201).json({
    id: info.lastInsertRowid,
    name: name.trim(),
    email: email.toLowerCase().trim(),
    verein: verein.trim(),
    role: "member",
  });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Bitte E-Mail und Passwort eingeben." });
  }

  const user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(String(email).toLowerCase().trim());

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "E-Mail oder Passwort ist falsch." });
  }

  req.session.userId = user.id;
  req.session.role = user.role;
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    verein: user.verein,
    role: user.role,
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

router.get("/me", (req, res) => {
  if (!req.session.userId) {
    return res.json({ user: null });
  }
  const user = db
    .prepare("SELECT id, name, email, verein, role FROM users WHERE id = ?")
    .get(req.session.userId);
  res.json({ user: user || null });
});

module.exports = router;
