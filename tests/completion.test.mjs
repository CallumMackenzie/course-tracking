import assert from "node:assert/strict";
import { test } from "node:test";
import { isCompleted, todayInCourseTimeZone } from "../dist-server/server/completion.js";

test("dated participation completes after its scheduled Vancouver day", () => {
  const attendance = { type: "participation", due_date: "2026-10-13", completed: false };
  assert.equal(isCompleted(attendance, "2026-10-12"), false);
  assert.equal(isCompleted(attendance, "2026-10-13"), false);
  assert.equal(isCompleted(attendance, "2026-10-14"), true);
});

test("undated participation stays ongoing and other items retain manual completion", () => {
  assert.equal(isCompleted({ type: "participation", completed: false }, "2026-12-30"), false);
  assert.equal(isCompleted({ type: "assignment", due_date: "2026-10-13", completed: false }, "2026-10-14"), false);
  assert.equal(isCompleted({ type: "assignment", completed: true }, "2026-10-13"), true);
});

test("the completion date changes at midnight in Vancouver", () => {
  assert.equal(todayInCourseTimeZone(new Date("2026-10-14T06:59:00Z")), "2026-10-13");
  assert.equal(todayInCourseTimeZone(new Date("2026-10-14T07:00:00Z")), "2026-10-14");
});
