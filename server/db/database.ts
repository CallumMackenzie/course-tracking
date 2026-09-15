import sqlite3 from "sqlite3";
import { databasePath } from "../config.js";

export const database = new sqlite3.Database(databasePath);

export function run(sql: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    database.run(sql, params, (error) => (error ? reject(error) : resolve()));
  });
}

export function all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    database.all(sql, params, (error, rows) =>
      error ? reject(error) : resolve(rows as T[])
    );
  });
}

export async function initializeSchema() {
  await run("PRAGMA journal_mode = WAL");
  await run(`
    CREATE TABLE IF NOT EXISTS deliverables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_key TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      date TEXT,
      start_date TEXT,
      due_date TEXT,
      sort_date TEXT,
      points REAL,
      grading_group TEXT,
      grading_group_worth_pct REAL,
      worth_pct_estimated INTEGER NOT NULL DEFAULT 0,
      course_code TEXT NOT NULL,
      worth_pct REAL NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const columns = await all<{ name: string }>("PRAGMA table_info(deliverables)");
  const additionalColumns = [
    { name: "sort_date", definition: "TEXT" },
    { name: "points", definition: "REAL" },
    { name: "grading_group", definition: "TEXT" },
    { name: "grading_group_worth_pct", definition: "REAL" },
    { name: "worth_pct_estimated", definition: "INTEGER NOT NULL DEFAULT 0" }
  ];

  for (const column of additionalColumns) {
    if (!columns.some((existing) => existing.name === column.name)) {
      await run(`ALTER TABLE deliverables ADD COLUMN ${column.name} ${column.definition}`);
    }
  }
}
