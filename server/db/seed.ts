import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { FieldValue } from "firebase-admin/firestore";
import { assessmentDataPath } from "../config.js";
import { database } from "./database.js";

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

function documentId(sourceKey: string) {
  return Buffer.from(sourceKey).toString("base64url");
}

let importPromise: Promise<void> | undefined;

export function importAssessmentData() {
  importPromise ??= importAssessmentDataOnce().catch((error) => {
    importPromise = undefined;
    throw error;
  });
  return importPromise;
}

async function importAssessmentDataOnce() {
  const sourceFiles = (await fs.readdir(assessmentDataPath))
    .filter((file) => file.endsWith("_assessments.json"))
    .sort();
  const sourceContents = await Promise.all(
    sourceFiles.map((file) => fs.readFile(path.join(assessmentDataPath, file), "utf8"))
  );
  const version = createHash("sha256").update(sourceContents.join("\n")).digest("hex");
  const metadataRef = database.collection("_metadata").doc("assessments");
  const metadata = await metadataRef.get();

  if (metadata.get("version") === version) return;

  const deliverables = sourceContents.flatMap(
    (raw) => JSON.parse(raw) as SeedDeliverable[]
  );
  const existing = await database.collection("deliverables").get();
  const existingById = new Map(existing.docs.map((document) => [document.id, document]));
  const existingByCourseAndName = new Map(
    existing.docs.map((document) => [
      `${document.get("course_code")}|${document.get("name")}`,
      document
    ])
  );
  const importedIds = new Set<string>();
  const batch = database.batch();

  for (const item of deliverables) {
    const sourceKey = `${item.course_code}|${item.type}|${item.name}`;
    const id = documentId(sourceKey);
    const current = existingById.get(id);
    const previous = current ?? existingByCourseAndName.get(`${item.course_code}|${item.name}`);
    importedIds.add(id);
    batch.set(
      database.collection("deliverables").doc(id),
      {
        source_key: sourceKey,
        type: item.type,
        name: item.name,
        date: item.date ?? null,
        start_date: item.start_date ?? null,
        due_date: item.due_date ?? null,
        sort_date: item.sort_date ?? null,
        course_code: item.course_code,
        worth_pct: item.worth_pct,
        points: item.points ?? null,
        grading_group: item.grading_group ?? null,
        grading_group_worth_pct: item.grading_group_worth_pct ?? null,
        worth_pct_estimated: item.worth_pct_estimated ?? false,
        ...(current ? {} : { completed: previous?.get("completed") ?? false }),
        updated_at: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  }

  for (const document of existing.docs) {
    if (!importedIds.has(document.id)) batch.delete(document.ref);
  }

  batch.set(metadataRef, {
    version,
    imported_at: FieldValue.serverTimestamp(),
    item_count: deliverables.length
  });
  await batch.commit();
}
