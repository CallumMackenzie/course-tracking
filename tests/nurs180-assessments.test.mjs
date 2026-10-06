import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const assessments = JSON.parse(
  readFileSync(new URL("../data/assessments/nurs180_2026w1_assessments.json", import.meta.url), "utf8")
);

test("NURS 180 Self-Care Strategy Paper matches the Canvas assignment", () => {
  const paper = assessments.find((item) => item.name === "Self-Care Strategy Paper");
  assert.ok(paper);
  assert.equal(paper.start_date, "2026-09-22");
  assert.equal(paper.due_date, "2026-10-18");
  assert.equal(paper.sort_date, undefined);
  assert.equal(paper.points, 20);
  assert.equal(paper.worth_pct, 20);
});

test("NURS 180 attendance matches the nine dated Canvas entries", () => {
  const attendance = assessments.filter((item) => item.type === "participation");
  assert.deepEqual(attendance.map((item) => item.due_date), [
    "2026-09-22", "2026-09-29", "2026-10-13", "2026-10-20", "2026-10-27",
    "2026-11-03", "2026-11-17", "2026-11-24", "2026-12-01"
  ]);
  assert.ok(attendance.every((item) => item.worth_pct === 2 && item.points === 2));
  assert.equal(attendance.reduce((total, item) => total + item.worth_pct, 0), 18);
});

test("NURS 180 assessment weights total 100%", () => {
  assert.equal(assessments.reduce((total, item) => total + item.worth_pct, 0), 100);
});
