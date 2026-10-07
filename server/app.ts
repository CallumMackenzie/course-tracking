import express from "express";
import { FieldValue } from "firebase-admin/firestore";
import { requireAccessToken, requireMcpAccessToken } from "./auth.js";
import { isCompleted, todayInCourseTimeZone } from "./completion.js";
import { loadCourseContent } from "./course-content.js";
import { database } from "./db/database.js";
import { importAssessmentData } from "./db/seed.js";
import { handleMcpRequest } from "./mcp.js";

export const app = express();

app.use(express.json());

app.post("/api/auth", requireAccessToken, (_request, response) => {
  response.status(204).end();
});

app.post("/api/mcp", requireMcpAccessToken, handleMcpRequest);
app.all("/api/mcp", requireMcpAccessToken, (_request, response) => {
  response.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null
  });
});

app.use("/api", requireAccessToken);

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
    await importAssessmentData();
    const snapshot = await database.collection("deliverables").get();
    const today = todayInCourseTimeZone();
    response.json(snapshot.docs.map((document) => {
      const data = document.data();
      return { id: document.id, ...data, completed: isCompleted(data, today) };
    }));
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "Unable to load deliverables." });
  }
});

app.patch("/api/deliverables/:id/completion", async (request, response) => {
  const id = request.params.id;
  const completed = request.body?.completed;

  if (!/^[A-Za-z0-9_-]{1,1500}$/.test(id) || typeof completed !== "boolean") {
    response.status(400).json({ error: "A valid id and boolean completed value are required." });
    return;
  }

  try {
    await importAssessmentData();
    const reference = database.collection("deliverables").doc(id);
    const deliverable = await reference.get();

    if (!deliverable.exists) {
      response.status(404).json({ error: "Deliverable not found." });
      return;
    }

    if (deliverable.get("type") === "participation") {
      response.status(400).json({ error: "Participation items cannot be completed manually." });
      return;
    }

    await reference.update({ completed, updated_at: FieldValue.serverTimestamp() });
    response.json({ id, completed });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "Unable to update completion." });
  }
});
