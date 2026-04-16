import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "golfnow.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initializeDb(db);
  }
  return db;
}

function initializeDb(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      zip_code TEXT NOT NULL,
      radius_miles INTEGER NOT NULL DEFAULT 25,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS favorite_courses (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      course_id TEXT NOT NULL,
      course_name TEXT NOT NULL,
      star_rating INTEGER NOT NULL DEFAULT 5,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(email, course_id)
    );

    CREATE TABLE IF NOT EXISTS search_history (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      zip_code TEXT NOT NULL,
      radius_miles INTEGER NOT NULL,
      results_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_favorites_email ON favorite_courses(email);
    CREATE INDEX IF NOT EXISTS idx_preferences_email ON user_preferences(email);
  `);
}
