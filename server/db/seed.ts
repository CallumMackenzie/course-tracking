import fs from "node:fs/promises";
import path from "node:path";
import { assessmentDataPath } from "../config.js";
import { run } from "./database.js";

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

export async function importAssessmentData() {
  const sourceFiles = (await fs.readdir(assessmentDataPath))
    .filter((file) => file.endsWith("_assessments.json"))
    .sort();
  const importedSourceKeys: string[] = [];

  for (const sourceFile of sourceFiles) {
    const raw = await fs.readFile(path.join(assessmentDataPath, sourceFile), "utf8");
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
