import fs from "node:fs/promises";
import path from "node:path";
import { courseContentDataPath } from "./config.js";
import { courseLinks, type CourseFile } from "./courses.js";

export type CourseContent = {
  course_code: string;
  course_webpage: string | null;
  course_files: CourseFile[];
  date: string;
  title: string;
  readings: string[];
  links: string[];
};

export async function loadCourseContent(date?: string) {
  const sourceFiles = (await fs.readdir(courseContentDataPath))
    .filter((file) => file.endsWith("_content.json"))
    .sort();

  const content = await Promise.all(
    sourceFiles.map(async (sourceFile) => {
      const raw = await fs.readFile(path.join(courseContentDataPath, sourceFile), "utf8");
      return JSON.parse(raw) as CourseContent[];
    })
  );

  return content
    .flat()
    .filter((item) => !date || item.date === date)
    .map((item) => ({ ...item, ...courseLinks(item.course_code) }))
    .sort((left, right) =>
      left.date.localeCompare(right.date) || left.course_code.localeCompare(right.course_code)
    );
}
