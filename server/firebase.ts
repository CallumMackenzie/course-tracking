import { onRequest } from "firebase-functions/v2/https";
import { app } from "./app.js";
import { courseTrackerAccessToken } from "./auth.js";

export const api = onRequest(
  {
    region: "us-west1",
    maxInstances: 3,
    secrets: [courseTrackerAccessToken]
  },
  app
);
