import { app } from "./app.js";
import { port } from "./config.js";
import { initializeSchema } from "./db/database.js";
import { importAssessmentData } from "./db/seed.js";

async function startServer() {
  await initializeSchema();
  await importAssessmentData();

  app.listen(port, () => {
    console.log(`Course Tracker running at http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to initialize Course Tracker", error);
  process.exit(1);
});
