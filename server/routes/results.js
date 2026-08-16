const express = require("express");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../auth");

const router = express.Router();

const ALLOWED_DISZIPLINEN = [
  "Feldschiessen",
  "Feldstich",
  "Lupi Bezirks-Einzelmatch",
  "Bezirksverbandsschiessen",
  "Bezirkskonkurrenz",
  "Bezirksmatch",
  "Jugend / Nachwuchs",
  "Sonstiges",
];

router.get("/", (req, res) => {
  const { disziplin, jahr } = req.query;
  let sql = `
    SELECT id, subject_name AS name, subject_verein AS verein, disziplin,
           wettkampf, jahr, kategorie, punkte, rang, created_at
    FROM results
  `;
  const clauses = [];
  const params = [];
  if (disziplin) {
    clauses.push("disziplin = ?");
    params.push(disziplin);
  }
  if (jahr) {
    clauses.push("jahr = ?");
    params.push(Number(jahr));
  }
  if (clauses.length) {
    sql += " WHERE " + clauses.join(" AND ");
  }
  sql += " ORDER BY jahr DESC, punkte DESC, created_at DESC LIMIT 200";

  const rows = db.prepare(sql).all(...params);
  res.json({ results: rows });
});

router.get("/mine", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, subject_name AS name, subject_verein AS verein, disziplin,
              wettkampf, jahr, kategorie, punkte, rang, created_at
       FROM results WHERE entered_by_user_id = ? ORDER BY jahr DESC, created_at DESC`
    )
    .all(req.session.userId);
  res.json({ results: rows });
});

router.post("/", requireAuth, (req, res) => {
  const { disziplin, wettkampf, jahr, kategorie, punkte, rang } = req.body || {};
  let { subject_name, subject_verein } = req.body || {};

  const currentUser = db
    .prepare("SELECT role FROM users WHERE id = ?")
    .get(req.session.userId);
  const isAdmin = currentUser && currentUser.role === "admin";

  if (isAdmin && subject_name && subject_verein) {
    subject_name = String(subject_name).trim();
    subject_verein = String(subject_verein).trim();
    if (!subject_name || !subject_verein) {
      return res
        .status(400)
        .json({ error: "Name und Verein dürfen nicht leer sein." });
    }
  } else {
    // Everyone else (and admins who leave the fields blank) can only
    // enter a result for themselves.
    const self = db
      .prepare("SELECT name, verein FROM users WHERE id = ?")
      .get(req.session.userId);
    subject_name = self.name;
    subject_verein = self.verein;
  }

  if (!disziplin || !ALLOWED_DISZIPLINEN.includes(disziplin)) {
    return res.status(400).json({ error: "Bitte eine gültige Disziplin wählen." });
  }
  if (!wettkampf || !String(wettkampf).trim()) {
    return res.status(400).json({ error: "Bitte den Wettkampf angeben." });
  }
  const jahrNum = Number(jahr);
  if (!Number.isInteger(jahrNum) || jahrNum < 1900 || jahrNum > 2100) {
    return res.status(400).json({ error: "Bitte ein gültiges Jahr angeben." });
  }
  const punkteNum = Number(punkte);
  if (Number.isNaN(punkteNum)) {
    return res.status(400).json({ error: "Bitte eine gültige Punktzahl angeben." });
  }
  let rangNum = null;
  if (rang !== undefined && rang !== null && rang !== "") {
    rangNum = Number(rang);
    if (!Number.isInteger(rangNum) || rangNum < 1) {
      return res.status(400).json({ error: "Der Rang muss eine positive Zahl sein." });
    }
  }

  const info = db
    .prepare(
      `INSERT INTO results (entered_by_user_id, subject_name, subject_verein, disziplin, wettkampf, jahr, kategorie, punkte, rang)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.session.userId,
      subject_name,
      subject_verein,
      disziplin,
      String(wettkampf).trim(),
      jahrNum,
      kategorie ? String(kategorie).trim() : null,
      punkteNum,
      rangNum
    );

  const created = db
    .prepare(
      `SELECT id, subject_name AS name, subject_verein AS verein, disziplin,
              wettkampf, jahr, kategorie, punkte, rang, created_at
       FROM results WHERE id = ?`
    )
    .get(info.lastInsertRowid);
  res.status(201).json({ result: created });
});

function parseCsvLine(line) {
  return line.split(",").map((s) => s.trim());
}

router.post("/import", requireAuth, requireAdmin, (req, res) => {
  const { csv } = req.body || {};
  if (!csv || !String(csv).trim()) {
    return res.status(400).json({ error: "Bitte CSV-Daten einfügen." });
  }

  const lines = String(csv).split(/\r?\n/).filter((l) => l.trim().length);
  if (lines.length < 2) {
    return res
      .status(400)
      .json({ error: "CSV braucht eine Kopfzeile und mindestens eine Datenzeile." });
  }

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const required = ["name", "verein", "disziplin", "wettkampf", "jahr", "punkte"];
  const missing = required.filter((r) => !header.includes(r));
  if (missing.length) {
    return res
      .status(400)
      .json({ error: "Kopfzeile fehlt: " + missing.join(", ") + ". Erwartet: name,verein,disziplin,wettkampf,jahr,kategorie,punkte,rang" });
  }

  const idx = {};
  header.forEach((h, i) => {
    idx[h] = i;
  });

  const insert = db.prepare(
    `INSERT INTO results (entered_by_user_id, subject_name, subject_verein, disziplin, wettkampf, jahr, kategorie, punkte, rang)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let imported = 0;
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const name = cols[idx.name];
    const verein = cols[idx.verein];
    const disziplin = cols[idx.disziplin];
    const wettkampf = cols[idx.wettkampf];
    const jahr = Number(cols[idx.jahr]);
    const kategorie = idx.kategorie !== undefined ? cols[idx.kategorie] : "";
    const punkte = Number(cols[idx.punkte]);
    const rang = idx.rang !== undefined && cols[idx.rang] ? Number(cols[idx.rang]) : null;

    if (
      !name ||
      !verein ||
      !ALLOWED_DISZIPLINEN.includes(disziplin) ||
      !wettkampf ||
      !Number.isInteger(jahr) ||
      Number.isNaN(punkte)
    ) {
      errors.push(`Zeile ${i + 1}: ungültig oder unbekannte Disziplin, übersprungen.`);
      continue;
    }

    insert.run(
      req.session.userId,
      name,
      verein,
      disziplin,
      wettkampf,
      jahr,
      kategorie || null,
      punkte,
      Number.isInteger(rang) ? rang : null
    );
    imported++;
  }

  res.status(201).json({ imported, skipped: errors.length, errors });
});

router.delete("/:id", requireAuth, (req, res) => {
  const result = db
    .prepare("SELECT * FROM results WHERE id = ?")
    .get(req.params.id);

  if (!result) {
    return res.status(404).json({ error: "Eintrag nicht gefunden." });
  }
  const currentUser = db
    .prepare("SELECT role FROM users WHERE id = ?")
    .get(req.session.userId);
  if (
    result.entered_by_user_id !== req.session.userId &&
    (!currentUser || currentUser.role !== "admin")
  ) {
    return res.status(403).json({ error: "Sie können nur eigene Einträge löschen." });
  }

  db.prepare("DELETE FROM results WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
