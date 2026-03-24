-- Band Request Portal - D1 Database Schema
-- Already applied to production database. Keep this file for reference.

CREATE TABLE IF NOT EXISTS director (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('repair','materials')),
  name TEXT NOT NULL,
  grade TEXT NOT NULL,
  submitter TEXT NOT NULL CHECK(submitter IN ('student','parent')),
  email TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in-progress','done','sent-out')),
  instrument TEXT DEFAULT '',
  ownership TEXT DEFAULT '',
  locker TEXT DEFAULT '',
  severity TEXT DEFAULT '',
  description TEXT DEFAULT '',
  items TEXT DEFAULT '[]',
  location TEXT DEFAULT '',
  submitted_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id TEXT NOT NULL REFERENCES tickets(id),
  text TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  director_id INTEGER NOT NULL REFERENCES director(id),
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
