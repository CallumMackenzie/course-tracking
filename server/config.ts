import path from "node:path";

const projectRoot = process.cwd();
export const assessmentDataPath = path.join(projectRoot, "data", "assessments");
export const courseContentDataPath = path.join(projectRoot, "data", "course-content");
export const databasePath = path.join(projectRoot, "course-tracking.db");
export const clientBuildPath = path.join(projectRoot, "dist");
export const port = Number(process.env.PORT) || 3001;
