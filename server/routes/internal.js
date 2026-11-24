const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../auth");

const router = express.Router();

const uploadDir = path.join(__dirname, "..", "..", "data", "internal-uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeExt = path.extname(file.originalname).slice(0, 10);
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + safeExt);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

router.get("/documents", requireAuth, requireAdmin, (req, res) => {
  const rows = db
    .prepare(
      `SELECT internal_documents.id, internal_documents.title, internal_documents.original_name,
              internal_documents.created_at, users.name AS uploaded_by_name
       FROM internal_documents
       JOIN users ON users.id = internal_documents.uploaded_by
       ORDER BY internal_documents.created_at DESC`
    )
    .all();
  res.json({ documents: rows });
});

router.post(
  "/documents",
  requireAuth,
  requireAdmin,
  upload.single("file"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "Bitte eine Datei auswählen." });
    }
    const title = (req.body.title || req.file.originalname).trim();

    const info = db
      .prepare(
        `INSERT INTO internal_documents (title, filename, original_name, uploaded_by)
         VALUES (?, ?, ?, ?)`
      )
      .run(title, req.file.filename, req.file.originalname, req.session.userId);

    res.status(201).json({ id: info.lastInsertRowid, title });
  }
);

router.get("/documents/:id/download", requireAuth, requireAdmin, (req, res) => {
  const doc = db
    .prepare("SELECT * FROM internal_documents WHERE id = ?")
    .get(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: "Dokument nicht gefunden." });
  }
  const filePath = path.join(uploadDir, doc.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Datei nicht mehr vorhanden." });
  }
  res.download(filePath, doc.original_name);
});

router.delete("/documents/:id", requireAuth, requireAdmin, (req, res) => {
  const doc = db
    .prepare("SELECT * FROM internal_documents WHERE id = ?")
    .get(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: "Dokument nicht gefunden." });
  }
  const filePath = path.join(uploadDir, doc.filename);
  fs.unlink(filePath, () => {});
  db.prepare("DELETE FROM internal_documents WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
