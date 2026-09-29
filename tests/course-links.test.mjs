import assert from "node:assert/strict";
import { test } from "node:test";
import { courseLinks } from "../dist-server/server/courses.js";

test("returns course webpages", () => {
  assert.equal(
    courseLinks("CPSC 425").course_webpage,
    "https://www.cs.ubc.ca/~aerion1/teaching/cpsc-425/2026w1/"
  );
  assert.equal(
    courseLinks("CPSC 340").course_webpage,
    "https://www.students.cs.ubc.ca/~cs-340/"
  );
  assert.equal(
    courseLinks("STAT 406").course_webpage,
    "https://ubc-stat.github.io/stat-406/syllabus.html"
  );
});

test("returns the hosted STAT 305 schedule", () => {
  assert.deepEqual(courseLinks("STAT 305"), {
    course_webpage: null,
    course_files: [
      {
        name: "Course schedule",
        url: "https://callum-course-tracker.web.app/course-files/stat305/STAT305-Schedule.pdf"
      }
    ]
  });
});

test("returns the hosted NURS 180 syllabus", () => {
  assert.deepEqual(courseLinks("NURS 180"), {
    course_webpage: null,
    course_files: [
      {
        name: "Course syllabus",
        url: "https://callum-course-tracker.web.app/course-files/nurs180/NURS180-Syllabus.pdf"
      }
    ]
  });
});

test("returns an empty shape for courses without configured links", () => {
  assert.deepEqual(courseLinks("UNKNOWN 100"), {
    course_webpage: null,
    course_files: []
  });
});
