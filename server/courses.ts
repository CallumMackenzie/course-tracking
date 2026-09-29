export type CourseFile = {
  name: string;
  url: string;
};

export type CourseLinks = {
  course_webpage: string | null;
  course_files: CourseFile[];
};

const HOSTING_ORIGIN = "https://callum-course-tracker.web.app";

const COURSE_LINKS: Record<string, CourseLinks> = {
  "CPSC 340": {
    course_webpage: "https://www.students.cs.ubc.ca/~cs-340/",
    course_files: []
  },
  "CPSC 425": {
    course_webpage: "https://www.cs.ubc.ca/~aerion1/teaching/cpsc-425/2026w1/",
    course_files: []
  },
  "NURS 180": {
    course_webpage: null,
    course_files: [
      {
        name: "Course syllabus",
        url: `${HOSTING_ORIGIN}/course-files/nurs180/NURS180-Syllabus.pdf`
      }
    ]
  },
  "STAT 305": {
    course_webpage: null,
    course_files: [
      {
        name: "Course schedule",
        url: `${HOSTING_ORIGIN}/course-files/stat305/STAT305-Schedule.pdf`
      }
    ]
  },
  "STAT 406": {
    course_webpage: "https://ubc-stat.github.io/stat-406/syllabus.html",
    course_files: []
  }
};

export function courseLinks(courseCode: string): CourseLinks {
  const links = COURSE_LINKS[courseCode];
  return links
    ? { course_webpage: links.course_webpage, course_files: [...links.course_files] }
    : { course_webpage: null, course_files: [] };
}
