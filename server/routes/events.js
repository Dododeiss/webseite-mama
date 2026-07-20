const express = require("express");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../auth");

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get("/", (req, res) => {
  const { upcoming } = req.query;
  let sql = `
    SELECT events.*, users.name AS created_by_name
    FROM events
    JOIN users ON users.id = events.created_by
  `;
  const params = [];
  if (upcoming) {
    sql += " WHERE date(events.start_date) >= date('now')";
  }
  sql += " ORDER BY events.start_date ASC";

  const rows = db.prepare(sql).all(...params);
  res.json({ events: rows });
});

router.post("/", requireAuth, requireAdmin, (req, res) => {
  const { title, category, location, start_date, end_date, description } =
    req.body || {};

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: "Bitte einen Titel angeben." });
  }
  if (!start_date || !DATE_RE.test(start_date)) {
    return res
      .status(400)
      .json({ error: "Bitte ein gültiges Datum (JJJJ-MM-TT) angeben." });
  }
  if (end_date && !DATE_RE.test(end_date)) {
    return res
      .status(400)
      .json({ error: "Enddatum muss im Format JJJJ-MM-TT sein." });
  }

  const info = db
    .prepare(
      `INSERT INTO events (title, category, location, start_date, end_date, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      String(title).trim(),
      category ? String(category).trim() : null,
      location ? String(location).trim() : null,
      start_date,
      end_date || null,
      description ? String(description).trim() : null,
      req.session.userId
    );

  const created = db
    .prepare("SELECT * FROM events WHERE id = ?")
    .get(info.lastInsertRowid);
  res.status(201).json({ event: created });
});

router.delete("/:id", requireAuth, requireAdmin, (req, res) => {
  const event = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id);
  if (!event) {
    return res.status(404).json({ error: "Termin nicht gefunden." });
  }
  db.prepare("DELETE FROM events WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
