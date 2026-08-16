const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../auth");

const router = express.Router();

const uploadDir = path.join(__dirname, "..", "..", "data", "result-documents");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + ".pdf");
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("invalid_type"));
    }
    cb(null, true);
  },
});

router.get("/", (req, res) => {
  const rows = db
    .prepare(
      `SELECT result_documents.id, result_documents.title, result_documents.original_name,
              result_documents.filename, result_documents.jahr, result_documents.disziplin,
              result_documents.created_at, users.name AS uploaded_by_name
       FROM result_documents
       JOIN users ON users.id = result_documents.uploaded_by
       ORDER BY result_documents.jahr DESC, result_documents.created_at DESC`
    )
    .all();
  res.json({ documents: rows });
});

router.post("/", requireAuth, requireAdmin, (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      const message =
        err.message === "invalid_type"
          ? "Bitte eine PDF-Datei auswählen."
          : "Datei zu gross (max. 20 MB) oder ungültig.";
      return res.status(400).json({ error: message });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Bitte eine PDF-Datei auswählen." });
    }

    const title = (req.body.title || req.file.originalname).trim();
    const jahr = req.body.jahr ? Number(req.body.jahr) : null;
    const disziplin = req.body.disziplin ? String(req.body.disziplin).trim() : null;

    const info = db
      .prepare(
        `INSERT INTO result_documents (title, filename, original_name, jahr, disziplin, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        title,
        req.file.filename,
        req.file.originalname,
        Number.isInteger(jahr) ? jahr : null,
        disziplin || null,
        req.session.userId
      );

    const created = db
      .prepare(
        `SELECT result_documents.id, result_documents.title, result_documents.original_name,
                result_documents.filename, result_documents.jahr, result_documents.disziplin,
                result_documents.created_at, users.name AS uploaded_by_name
         FROM result_documents
         JOIN users ON users.id = result_documents.uploaded_by
         WHERE result_documents.id = ?`
      )
      .get(info.lastInsertRowid);

    res.status(201).json({ document: created });
  });
});

router.delete("/:id", requireAuth, requireAdmin, (req, res) => {
  const doc = db
    .prepare("SELECT * FROM result_documents WHERE id = ?")
    .get(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: "Dokument nicht gefunden." });
  }
  fs.unlink(path.join(uploadDir, doc.filename), () => {});
  db.prepare("DELETE FROM result_documents WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
