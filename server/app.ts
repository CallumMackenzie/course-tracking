import express from "express";
import path from "node:path";
import { clientBuildPath } from "./config.js";
import { loadCourseContent } from "./course-content.js";
import { all, run } from "./db/database.js";

export const app = express();

app.use(express.json());

app.get("/api/course-content", async (request, response) => {
  const date = request.query.date;

  if (date !== undefined && (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
    response.status(400).json({ error: "Date must use YYYY-MM-DD format." });
    return;
  }

  try {
    response.json(await loadCourseContent(date));
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "Unable to load course content." });
  }
});

app.get("/api/deliverables", async (_request, response) => {
  try {
    const deliverables = await all<Record<string, unknown>>(
      `SELECT id, type, name, date, start_date, due_date, sort_date, course_code, worth_pct,
              points, grading_group, grading_group_worth_pct, worth_pct_estimated, completed
       FROM deliverables`
    );
    response.json(
      deliverables.map((item) => ({
        ...item,
        completed: Boolean(item.completed),
        worth_pct_estimated: Boolean(item.worth_pct_estimated)
      }))
    );
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "Unable to load deliverables." });
  }
});

app.patch("/api/deliverables/:id/completion", async (request, response) => {
  const id = Number(request.params.id);
  const completed = request.body?.completed;

  if (!Number.isInteger(id) || typeof completed !== "boolean") {
    response.status(400).json({ error: "A valid id and boolean completed value are required." });
    return;
  }

  try {
    const [deliverable] = await all<{ type: string }>(
      "SELECT type FROM deliverables WHERE id = ?",
      [id]
    );

    if (!deliverable) {
      response.status(404).json({ error: "Deliverable not found." });
      return;
    }

    if (deliverable.type === "participation") {
      response.status(400).json({ error: "Participation items cannot be completed manually." });
      return;
    }

    await run(
      "UPDATE deliverables SET completed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [completed ? 1 : 0, id]
    );
    response.json({ id, completed });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "Unable to update completion." });
  }
});

app.use(express.static(clientBuildPath));
app.use((_request, response) => {
  response.sendFile(path.join(clientBuildPath, "index.html"));
});
