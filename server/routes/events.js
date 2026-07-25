const express = require("express");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../auth");

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get("/", (req, res) => {
  const { upcoming } = req.query;
  let sql = `
    SELECT events.*, users.name AS created_by_name,
           (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = events.id) AS registration_count
    FROM events
    JOIN users ON users.id = events.created_by
  `;
  const params = [];
  if (upcoming) {
    sql += " WHERE date(events.start_date) >= date('now')";
  }
  sql += " ORDER BY events.start_date ASC";

  const rows = db.prepare(sql).all(...params);

  if (req.session.userId) {
    const mine = new Set(
      db
        .prepare("SELECT event_id FROM event_registrations WHERE user_id = ?")
        .all(req.session.userId)
        .map((r) => r.event_id)
    );
    rows.forEach((r) => {
      r.is_registered = mine.has(r.id);
    });
  }

  res.json({ events: rows });
});

function icsEscape(str) {
  return String(str || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function isoDateToIcs(iso) {
  return iso.replace(/-/g, "");
}

function addOneDay(iso) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

router.get("/calendar.ics", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM events ORDER BY start_date ASC")
    .all();

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BSVZ//Kalender//DE",
    "CALSCALE:GREGORIAN",
  ];

  for (const e of rows) {
    lines.push("BEGIN:VEVENT");
    lines.push("UID:bsvz-event-" + e.id + "@bsvzuerich.ch");
    lines.push("DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z");
    lines.push("DTSTART;VALUE=DATE:" + isoDateToIcs(e.start_date));
    lines.push("DTEND;VALUE=DATE:" + addOneDay(e.end_date || e.start_date));
    lines.push("SUMMARY:" + icsEscape(e.title));
    if (e.location) lines.push("LOCATION:" + icsEscape(e.location));
    const descParts = [];
    if (e.category) descParts.push(e.category);
    if (e.description) descParts.push(e.description);
    if (descParts.length) lines.push("DESCRIPTION:" + icsEscape(descParts.join(" – ")));
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="bsvz-kalender.ics"');
  res.send(lines.join("\r\n"));
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

router.post("/:id/register", requireAuth, (req, res) => {
  const event = db.prepare("SELECT id FROM events WHERE id = ?").get(req.params.id);
  if (!event) {
    return res.status(404).json({ error: "Termin nicht gefunden." });
  }
  try {
    db.prepare(
      "INSERT INTO event_registrations (event_id, user_id) VALUES (?, ?)"
    ).run(req.params.id, req.session.userId);
  } catch (e) {
    // Unique constraint -> already registered, treat as success (idempotent).
  }
  const count = db
    .prepare("SELECT COUNT(*) AS c FROM event_registrations WHERE event_id = ?")
    .get(req.params.id).c;
  res.status(201).json({ ok: true, registration_count: count });
});

router.delete("/:id/register", requireAuth, (req, res) => {
  db.prepare(
    "DELETE FROM event_registrations WHERE event_id = ? AND user_id = ?"
  ).run(req.params.id, req.session.userId);
  const count = db
    .prepare("SELECT COUNT(*) AS c FROM event_registrations WHERE event_id = ?")
    .get(req.params.id).c;
  res.json({ ok: true, registration_count: count });
});

router.get("/:id/registrations", requireAuth, requireAdmin, (req, res) => {
  const rows = db
    .prepare(
      `SELECT users.name, users.verein, event_registrations.created_at
       FROM event_registrations
       JOIN users ON users.id = event_registrations.user_id
       WHERE event_registrations.event_id = ?
       ORDER BY event_registrations.created_at ASC`
    )
    .all(req.params.id);
  res.json({ registrations: rows });
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
