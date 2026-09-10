import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import sqlite3 from "sqlite3";

type SeedDeliverable = {
  type: string;
  name: string;
  date?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  sort_date?: string | null;
  points?: number | null;
  grading_group?: string | null;
  grading_group_worth_pct?: number | null;
  worth_pct_estimated?: boolean;
  course_code: string;
  worth_pct: number;
};

const projectRoot = process.cwd();
const databasePath = path.join(projectRoot, "course-tracking.db");
const database = new sqlite3.Database(databasePath);

function run(sql: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    database.run(sql, params, (error) => (error ? reject(error) : resolve()));
  });
}

function all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    database.all(sql, params, (error, rows) =>
      error ? reject(error) : resolve(rows as T[])
    );
  });
}

async function initializeDatabase() {
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

  const sourceFiles = (await fs.readdir(projectRoot)).filter((file) =>
    file.endsWith("_assessments.json")
  );

  const importedSourceKeys: string[] = [];

  for (const sourceFile of sourceFiles) {
    const raw = await fs.readFile(path.join(projectRoot, sourceFile), "utf8");
    const deliverables = JSON.parse(raw) as SeedDeliverable[];

    for (const item of deliverables) {
      const sourceKey = `${item.course_code}|${item.type}|${item.name}`;
      importedSourceKeys.push(sourceKey);
      await run(
        `
          INSERT INTO deliverables (
            source_key, type, name, date, start_date, due_date, sort_date, course_code,
            worth_pct, points, grading_group, grading_group_worth_pct, worth_pct_estimated
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(source_key) DO UPDATE SET
            date = excluded.date,
            start_date = excluded.start_date,
            due_date = excluded.due_date,
            sort_date = excluded.sort_date,
            worth_pct = excluded.worth_pct,
            points = excluded.points,
            grading_group = excluded.grading_group,
            grading_group_worth_pct = excluded.grading_group_worth_pct,
            worth_pct_estimated = excluded.worth_pct_estimated,
            updated_at = CURRENT_TIMESTAMP
        `,
        [
          sourceKey,
          item.type,
          item.name,
          item.date ?? null,
          item.start_date ?? null,
          item.due_date ?? null,
          item.sort_date ?? null,
          item.course_code,
          item.worth_pct,
          item.points ?? null,
          item.grading_group ?? null,
          item.grading_group_worth_pct ?? null,
          item.worth_pct_estimated ? 1 : 0
        ]
      );
    }
  }

  if (importedSourceKeys.length > 0) {
    const placeholders = importedSourceKeys.map(() => "?").join(", ");
    await run(
      `DELETE FROM deliverables WHERE source_key NOT IN (${placeholders})`,
      importedSourceKeys
    );
  }
}

const app = express();
app.use(express.json());

app.get("/api/deliverables", async (_request, response) => {
  try {
    const deliverables = await all<Record<string, unknown>>(
      `SELECT id, type, name, date, start_date, due_date, sort_date, course_code, worth_pct,
              points, grading_group, grading_group_worth_pct, worth_pct_estimated, completed
       FROM deliverables`
    );
    response.json(
      deliverables.map((item) => ({
        ...item,
        completed: Boolean(item.completed),
        worth_pct_estimated: Boolean(item.worth_pct_estimated)
      }))
    );
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "Unable to load deliverables." });
  }
});

app.patch("/api/deliverables/:id/completion", async (request, response) => {
  const id = Number(request.params.id);
  const completed = request.body?.completed;

  if (!Number.isInteger(id) || typeof completed !== "boolean") {
    response.status(400).json({ error: "A valid id and boolean completed value are required." });
    return;
  }

  try {
    const [deliverable] = await all<{ type: string }>(
      "SELECT type FROM deliverables WHERE id = ?",
      [id]
    );

    if (!deliverable) {
      response.status(404).json({ error: "Deliverable not found." });
      return;
    }

    if (deliverable.type === "participation") {
      response.status(400).json({ error: "Participation items cannot be completed manually." });
      return;
    }

    await run(
      "UPDATE deliverables SET completed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [completed ? 1 : 0, id]
    );
    response.json({ id, completed });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "Unable to update completion." });
  }
});

const clientPath = path.join(projectRoot, "dist");
app.use(express.static(clientPath));
app.use((_request, response) => {
  response.sendFile(path.join(clientPath, "index.html"));
});

const port = Number(process.env.PORT) || 3001;

initializeDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Course Tracker running at http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize Course Tracker", error);
    process.exit(1);
  });
