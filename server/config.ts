import path from "node:path";

const projectRoot = process.cwd();
export const assessmentDataPath = path.join(projectRoot, "data", "assessments");
export const courseContentDataPath = path.join(projectRoot, "data", "course-content");
