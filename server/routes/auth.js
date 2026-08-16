const path = require("path");
const fs = require("fs");
const express = require("express");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const db = require("../db");
const { requireAuth } = require("../auth");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const avatarDir = path.join(__dirname, "..", "..", "data", "avatars");
if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
}

const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" }[file.mimetype] || "";
    cb(null, `user-${req.session.userId}-${Date.now()}${ext}`);
  },
});
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_AVATAR_TYPES.includes(file.mimetype)) {
      return cb(new Error("invalid_type"));
    }
    cb(null, true);
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Zu viele Anmeldeversuche. Bitte in 15 Minuten erneut versuchen." },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Zu viele Registrierungen von dieser Adresse. Bitte später erneut versuchen." },
});

router.post("/register", registerLimiter, (req, res) => {
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

router.post("/login", loginLimiter, (req, res) => {
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
    .prepare(
      "SELECT id, name, email, verein, role, avatar_filename FROM users WHERE id = ?"
    )
    .get(req.session.userId);
  res.json({ user: user || null });
});

router.post("/change-password", requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ error: "Bitte aktuelles und neues Passwort eingeben." });
  }
  if (String(newPassword).length < 8) {
    return res
      .status(400)
      .json({ error: "Das neue Passwort muss mindestens 8 Zeichen haben." });
  }

  const user = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(req.session.userId);
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: "Aktuelles Passwort ist falsch." });
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
    passwordHash,
    req.session.userId
  );
  res.json({ ok: true });
});

router.post("/avatar", requireAuth, (req, res) => {
  uploadAvatar.single("avatar")(req, res, (err) => {
    if (err) {
      const message =
        err.message === "invalid_type"
          ? "Bitte ein JPG-, PNG- oder WebP-Bild wählen."
          : "Datei zu gross (max. 5 MB) oder ungültig.";
      return res.status(400).json({ error: message });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Bitte ein Bild auswählen." });
    }

    const previous = db
      .prepare("SELECT avatar_filename FROM users WHERE id = ?")
      .get(req.session.userId);

    db.prepare("UPDATE users SET avatar_filename = ? WHERE id = ?").run(
      req.file.filename,
      req.session.userId
    );

    if (previous && previous.avatar_filename) {
      fs.unlink(path.join(avatarDir, previous.avatar_filename), () => {});
    }

    res.json({ avatar_filename: req.file.filename });
  });
});

module.exports = router;
