const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "civicflow.db");
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const initDB = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_type  TEXT NOT NULL CHECK (issue_type IN ('water','civic')),
      sub_type    TEXT NOT NULL,
      description TEXT,
      latitude    REAL NOT NULL,
      longitude   REAL NOT NULL,
      location    TEXT,
      ward        TEXT,
      status      TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','in_progress','resolved')),
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS clusters (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_type   TEXT NOT NULL,
      center_lat   REAL NOT NULL,
      center_lng   REAL NOT NULL,
      report_ids   TEXT NOT NULL,
      report_count INTEGER NOT NULL DEFAULT 0,
      active       INTEGER NOT NULL DEFAULT 1,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wards (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL UNIQUE,
      total_reports INTEGER NOT NULL DEFAULT 0,
      resolved      INTEGER NOT NULL DEFAULT 0,
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const insertWard = db.prepare(`
    INSERT OR IGNORE INTO wards (name, total_reports, resolved) VALUES (?, ?, ?)
  `);
  insertWard.run("Ward 4 — Peddapuram",  22, 20);
  insertWard.run("Ward 7 — Rajahmundry", 18, 12);
  insertWard.run("Ward 12 — Kakinada",   14,  6);

  console.log("✅  SQLite database ready →", DB_PATH);
};

module.exports = { db, initDB };
