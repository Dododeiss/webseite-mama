const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");

const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(path.join(dataDir, "bsvz.db"));
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    verein TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entered_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_name TEXT NOT NULL,
    subject_verein TEXT NOT NULL,
    disziplin TEXT NOT NULL,
    wettkampf TEXT NOT NULL,
    jahr INTEGER NOT NULL,
    kategorie TEXT,
    punkte REAL NOT NULL,
    rang INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT,
    location TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT,
    description TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS event_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(event_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS internal_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// One-off migration: earlier versions had results.user_id (self-entry only).
// If that old column is still around, rebuild the table with the new
// entered_by_user_id / subject_name / subject_verein columns instead.
const resultsColumns = db.prepare("PRAGMA table_info(results)").all();
if (resultsColumns.some((c) => c.name === "user_id")) {
  db.exec("DROP TABLE results");
  db.exec(`
    CREATE TABLE results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entered_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject_name TEXT NOT NULL,
      subject_verein TEXT NOT NULL,
      disziplin TEXT NOT NULL,
      wettkampf TEXT NOT NULL,
      jahr INTEGER NOT NULL,
      kategorie TEXT,
      punkte REAL NOT NULL,
      rang INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

module.exports = db;
