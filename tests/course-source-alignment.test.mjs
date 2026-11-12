import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function data(course, kind) {
  return JSON.parse(readFileSync(new URL(`../data/${kind}/${course}_2026w1_${kind === "assessments" ? "assessments" : "content"}.json`, import.meta.url), "utf8"));
}

const assessment = (course, name) => data(course, "assessments").find((item) => item.name === name);

test("confirmed final exam dates replace estimated timeline dates", () => {
  for (const [course, date] of [
    ["stat406", "2026-12-11"],
    ["cpsc425", "2026-12-11"],
    ["stat305", "2026-12-19"],
    ["cpsc340", "2026-12-22"]
  ]) {
    const final = assessment(course, "Final Exam");
    assert.equal(final.date, date);
    assert.equal(final.sort_date, undefined);
  }
});

test("CPSC 425 schedule includes the midterm, quizzes and published slides", () => {
  const content = data("cpsc425", "course-content");
  assert.equal(content.find((item) => item.date === "2026-10-22")?.title, "Midterm Exam (in class)");
  for (const date of ["2026-09-24", "2026-10-06", "2026-10-20"]) {
    assert.match(content.find((item) => item.date === date)?.title ?? "", /Quiz [123]/);
  }
  assert.match(content.find((item) => item.date === "2026-11-03")?.title ?? "", /Quiz 4/);
  for (let lecture = 1; lecture <= 17; lecture++) {
    assert.ok(content.some((item) => item.links.some((url) => url.endsWith(`/Lecture${lecture}.pdf`))));
  }
  assert.ok(content.find((item) => item.date === "2026-10-27")?.links.some((url) => url.endsWith("/LectureNotes5.pdf")));
  const quizzes = data("cpsc425", "assessments").filter((item) => item.type === "quiz");
  assert.deepEqual(quizzes.map((item) => item.date), ["2026-09-24", "2026-10-06", "2026-10-20", "2026-11-03"]);
  assert.ok(quizzes.every((item) => item.worth_pct_estimated && item.grading_group_worth_pct === 10 && item.worth_pct === 2.5));
  assert.equal(quizzes.reduce((sum, item) => sum + item.worth_pct, 0), 10);
});

test("CPSC 340 assignments 4 and 5 use published availability and due dates", () => {
  assert.equal(assessment("cpsc340", "Assignment 4").start_date, "2026-10-21");
  assert.equal(assessment("cpsc340", "Assignment 4").due_date, "2026-11-04");
  assert.equal(assessment("cpsc340", "Assignment 5").start_date, "2026-11-06");
  assert.equal(assessment("cpsc340", "Assignment 5").due_date, "2026-11-20");
  assert.equal(assessment("cpsc340", "Assignment 5").sort_date, undefined);
});

test("STAT 305 revised schedule readings and final exam time are recorded", () => {
  const content = data("stat305", "course-content");
  const newNotes = new Map([
    ["2026-10-19", "6.1, 6.2"], ["2026-10-21", "6.3"],
    ["2026-10-23", "6.3-6.5"], ["2026-10-26", "6.7"],
    ["2026-10-30", "7.1-7.2"], ["2026-11-02", "7.3"],
    ["2026-11-13", "7.4"], ["2026-11-16", "7.5"],
    ["2026-11-20", "7.6-7.9"], ["2026-11-23", "8.1, 8.2"],
    ["2026-11-25", "8.3"], ["2026-11-27", "9.3, 9.4"],
    ["2026-11-30", "8.4"], ["2026-12-02", "9.1, 9.2"],
    ["2026-12-04", "9.5"]
  ]);
  for (const [date, sections] of newNotes) {
    assert.ok(content.find((item) => item.date === date)?.readings.includes(`Course notes (new) ${sections}`), date);
  }
  assert.ok(content.find((item) => item.date === "2026-10-23")?.readings.includes("Course notes (old) 6.3-6.4"));
  assert.equal(assessment("stat305", "Final Exam").start_time, "12:00");
});

test("STAT 305 labs avoid Thanksgiving and follow the first scheduled lab day", () => {
  for (const [number, date] of [[4, "2026-10-14"], [5, "2026-10-21"], [6, "2026-10-28"], [7, "2026-11-04"]]) {
    assert.equal(data("stat305", "assessments").find((item) => item.name.startsWith(`Lab ${number} —`))?.date, date);
  }
});

test("STAT 406 effort points are capped and lab deadlines remain unconfirmed", () => {
  const items = data("stat406", "assessments");
  const effort = items.filter((item) => ["assignment", "lab", "participation"].includes(item.type));
  assert.equal(effort.reduce((sum, item) => sum + item.worth_pct, 0), 68);
  assert.ok(effort.every((item) => item.grading_group_worth_pct === 58));
  assert.ok(items.filter((item) => item.type === "lab").every((item) => !item.due_date && item.sort_date));
});

test("NURS 180 Digital Detox has a confirmed date and provisional share of engagement marks", () => {
  const item = assessment("nurs180", "Week 8 Digital Detox Assignment");
  assert.equal(item.due_date, "2026-11-03");
  assert.equal(item.worth_pct_estimated, true);
  assert.equal(assessment("nurs180", "Other Weekly Engagement Activity (date TBD)").worth_pct_estimated, true);
});
