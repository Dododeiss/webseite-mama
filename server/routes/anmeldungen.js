const express = require("express");
const rateLimit = require("express-rate-limit");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../auth");
const { buildExport } = require("../export");

const router = express.Router();

const TYPEN = ["pistole", "bk-a", "bk-b", "bk-c"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PER_EVENT = 500;

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Zu viele Anmeldungen von dieser Adresse. Bitte später erneut versuchen." },
});

function todayZurich() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" });
}

function isRealDate(iso) {
  if (!DATE_RE.test(iso)) return false;
  const d = new Date(iso + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

function currentIsAdmin(req) {
  if (!req.session.userId) return false;
  const user = db.prepare("SELECT role FROM users WHERE id = ?").get(req.session.userId);
  return !!user && user.role === "admin";
}

function text(value, max) {
  if (value === undefined || value === null) return "";
  const s = String(value).trim();
  return s.length > max ? null : s;
}

function score(value) {
  if (value === undefined || value === null || String(value).trim() === "") return { value: null };
  const n = Number(String(value).replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 1000) return { error: true };
  return { value: Math.round(n * 10) / 10 };
}

function publicEvent(row) {
  return {
    id: row.id,
    typ: row.typ,
    title: row.title,
    deadline: row.deadline,
    info: row.info,
    contact_name: row.contact_name,
    contact_email: row.contact_email,
    slots: JSON.parse(row.slots || "[]"),
    anzahl: row.anzahl,
    is_open: row.deadline >= todayZurich(),
  };
}

const LIST_SQL = `
  SELECT a.*, (SELECT COUNT(*) FROM anmeldung_teilnehmer t WHERE t.anmeldung_id = a.id) AS anzahl
  FROM anmeldungen a
`;

router.get("/", (req, res) => {
  const showAll = req.query.all && currentIsAdmin(req);
  const rows = showAll
    ? db.prepare(LIST_SQL + " ORDER BY a.deadline DESC, a.id DESC").all()
    : db.prepare(LIST_SQL + " WHERE a.deadline >= ? ORDER BY a.deadline ASC, a.id ASC").all(todayZurich());
  res.json({ anmeldungen: rows.map(publicEvent) });
});

router.post("/", requireAuth, requireAdmin, (req, res) => {
  const body = req.body || {};
  const typ = String(body.typ || "");
  if (!TYPEN.includes(typ)) {
    return res.status(400).json({ error: "Bitte einen Wettkampf-Typ wählen." });
  }
  const title = text(body.title, 150);
  if (!title) return res.status(400).json({ error: "Bitte einen Titel angeben (max. 150 Zeichen)." });
  const deadline = String(body.deadline || "");
  if (!isRealDate(deadline)) {
    return res.status(400).json({ error: "Bitte einen gültigen Anmeldeschluss angeben." });
  }
  const info = text(body.info, 1000);
  const contactName = text(body.contact_name, 100);
  const contactEmail = text(body.contact_email, 150);
  if (info === null || contactName === null || contactEmail === null) {
    return res.status(400).json({ error: "Ein Textfeld ist zu lang." });
  }
  if (contactEmail && !EMAIL_RE.test(contactEmail)) {
    return res.status(400).json({ error: "Ungültige Kontakt-E-Mail-Adresse." });
  }

  let slots = [];
  if (typ === "pistole") {
    const raw = Array.isArray(body.slots) ? body.slots : String(body.slots || "").split(/\r?\n/);
    slots = raw.map((s) => String(s).trim()).filter(Boolean);
    if (!slots.length) {
      return res.status(400).json({ error: "Bitte mindestens ein Zeitfenster angeben (eines pro Zeile)." });
    }
    if (slots.length > 30 || slots.some((s) => s.length > 200)) {
      return res.status(400).json({ error: "Zu viele oder zu lange Zeitfenster." });
    }
  }

  // Optional: gleichzeitig einen Kalendertermin anlegen
  const kal = body.kalender && body.kalender.start_date ? body.kalender : null;
  let kalEnd = null;
  let kalLocation = null;
  if (kal) {
    if (!isRealDate(String(kal.start_date))) {
      return res.status(400).json({ error: "Bitte ein gültiges Wettkampfdatum für den Kalender angeben." });
    }
    kalEnd = kal.end_date ? String(kal.end_date) : null;
    if (kalEnd && (!isRealDate(kalEnd) || kalEnd < kal.start_date)) {
      return res.status(400).json({ error: "Das Enddatum im Kalender muss nach dem Startdatum liegen." });
    }
    kalLocation = text(kal.location, 150);
    if (kalLocation === null) {
      return res.status(400).json({ error: "Der Ort ist zu lang." });
    }
  }

  const info_ = db
    .prepare(
      `INSERT INTO anmeldungen (typ, title, deadline, info, contact_name, contact_email, slots, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      typ,
      title,
      deadline,
      info || null,
      contactName || null,
      contactEmail || null,
      JSON.stringify(slots),
      req.session.userId
    );
  if (kal) {
    db.prepare(
      `INSERT INTO events (title, category, location, start_date, end_date, anmeldung_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      title,
      typ === "pistole" ? "Bezirksmatch" : "Bezirkskonkurrenz",
      kalLocation || null,
      kal.start_date,
      kalEnd,
      info_.lastInsertRowid,
      req.session.userId
    );
  }
  const row = db.prepare(LIST_SQL + " WHERE a.id = ?").get(info_.lastInsertRowid);
  res.status(201).json({ anmeldung: publicEvent(row), kalender: !!kal });
});

router.delete("/:id", requireAuth, requireAdmin, (req, res) => {
  const info = db.prepare("DELETE FROM anmeldungen WHERE id = ?").run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: "Anmeldung nicht gefunden." });
  res.json({ ok: true });
});

router.get("/:id/teilnehmer", requireAuth, requireAdmin, (req, res) => {
  const event = db.prepare(LIST_SQL + " WHERE a.id = ?").get(req.params.id);
  if (!event) return res.status(404).json({ error: "Anmeldung nicht gefunden." });
  const teilnehmer = db
    .prepare("SELECT * FROM anmeldung_teilnehmer WHERE anmeldung_id = ? ORDER BY created_at ASC, id ASC")
    .all(req.params.id)
    .map((t) => ({ ...t, slots: JSON.parse(t.slots || "[]") }));
  res.json({ anmeldung: publicEvent(event), teilnehmer });
});

router.delete("/:id/teilnehmer/:tid", requireAuth, requireAdmin, (req, res) => {
  const info = db
    .prepare("DELETE FROM anmeldung_teilnehmer WHERE id = ? AND anmeldung_id = ?")
    .run(req.params.tid, req.params.id);
  if (!info.changes) return res.status(404).json({ error: "Eintrag nicht gefunden." });
  res.json({ ok: true });
});

router.get("/:id/export", requireAuth, requireAdmin, async (req, res) => {
  const event = db.prepare("SELECT * FROM anmeldungen WHERE id = ?").get(req.params.id);
  if (!event) return res.status(404).json({ error: "Anmeldung nicht gefunden." });
  const teilnehmer = db
    .prepare("SELECT * FROM anmeldung_teilnehmer WHERE anmeldung_id = ?")
    .all(req.params.id);
  try {
    const { buffer, ext, mime } = await buildExport(event, teilnehmer);
    const slug =
      event.title
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^A-Za-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "Anmeldungen";
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${slug}-Anmeldungen.${ext}"`);
    res.send(buffer);
  } catch (err) {
    console.error("Export fehlgeschlagen:", err);
    res.status(500).json({ error: "Die Liste konnte nicht erstellt werden." });
  }
});

// Öffentliche Anmeldung (ohne Login)
router.post("/:id/anmelden", registerLimiter, (req, res) => {
  const body = req.body || {};
  if (body.website) return res.status(201).json({ ok: true }); // Honeypot

  const event = db.prepare("SELECT * FROM anmeldungen WHERE id = ?").get(req.params.id);
  if (!event) return res.status(404).json({ error: "Diese Anmeldung gibt es nicht." });
  if (event.deadline < todayZurich()) {
    return res.status(410).json({ error: "Der Anmeldeschluss ist abgelaufen." });
  }

  const name = text(body.name, 80);
  const vorname = text(body.vorname, 80);
  const verein = text(body.verein, 120);
  if (!name || !vorname || !verein) {
    return res.status(400).json({ error: "Bitte Name, Vorname und Verein ausfüllen." });
  }

  const record = { name, vorname, verein, jahrgang: null, geb_datum: null, tel: null, lizenz: null, email: null, op: null, fs: null, bs: null, slots: "[]" };
  const thisYear = new Date().getFullYear();

  if (event.typ === "pistole") {
    const geb = String(body.geb_datum || "");
    if (!isRealDate(geb) || geb < "1900-01-01" || geb > todayZurich()) {
      return res.status(400).json({ error: "Bitte ein gültiges Geburtsdatum angeben." });
    }
    const email = text(body.email, 150);
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Bitte eine gültige E-Mail-Adresse angeben." });
    }
    const tel = text(body.tel, 30);
    const lizenz = text(body.lizenz, 30);
    if (tel === null || lizenz === null || (tel && !/^[0-9+()/.\-\s]{5,30}$/.test(tel))) {
      return res.status(400).json({ error: "Bitte eine gültige Telefonnummer angeben." });
    }
    const slotCount = JSON.parse(event.slots || "[]").length;
    const chosen = Array.isArray(body.slots) ? [...new Set(body.slots.map(Number))] : [];
    if (!chosen.length || chosen.some((i) => !Number.isInteger(i) || i < 0 || i >= slotCount)) {
      return res.status(400).json({ error: "Bitte mindestens ein Zeitfenster auswählen." });
    }
    Object.assign(record, { geb_datum: geb, email, tel: tel || null, lizenz: lizenz || null, slots: JSON.stringify(chosen.sort((a, b) => a - b)) });
  } else {
    const jahrgang = Number(body.jahrgang);
    if (!Number.isInteger(jahrgang) || jahrgang < 1900 || jahrgang > thisYear) {
      return res.status(400).json({ error: "Bitte einen gültigen Jahrgang angeben (z. B. 1975)." });
    }
    const op = score(body.op);
    const fs = score(body.fs);
    const bs = score(body.bs);
    if (op.error || fs.error || bs.error) {
      return res.status(400).json({ error: "Punktzahlen müssen Zahlen zwischen 0 und 1000 sein." });
    }
    Object.assign(record, { jahrgang, op: op.value, fs: fs.value, bs: bs.value });
  }

  const existing = db
    .prepare("SELECT name, vorname, jahrgang, geb_datum FROM anmeldung_teilnehmer WHERE anmeldung_id = ?")
    .all(event.id);
  if (existing.length >= MAX_PER_EVENT) {
    return res.status(409).json({ error: "Diese Anmeldung ist leider voll." });
  }
  const norm = (s) => String(s).toLocaleLowerCase("de");
  const duplicate = existing.some(
    (t) =>
      norm(t.name) === norm(name) &&
      norm(t.vorname) === norm(vorname) &&
      (t.jahrgang || 0) === (record.jahrgang || 0) &&
      (t.geb_datum || "") === (record.geb_datum || "")
  );
  if (duplicate) {
    return res.status(409).json({ error: "Diese Person ist bereits angemeldet." });
  }

  db.prepare(
    `INSERT INTO anmeldung_teilnehmer
       (anmeldung_id, name, vorname, verein, jahrgang, geb_datum, tel, lizenz, email, op, fs, bs, slots)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    event.id,
    record.name,
    record.vorname,
    record.verein,
    record.jahrgang,
    record.geb_datum,
    record.tel,
    record.lizenz,
    record.email,
    record.op,
    record.fs,
    record.bs,
    record.slots
  );

  res.status(201).json({ ok: true, name, vorname, verein });
});

module.exports = router;
