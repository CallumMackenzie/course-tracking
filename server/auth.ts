import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { defineSecret } from "firebase-functions/params";

export const courseTrackerAccessToken = defineSecret("COURSE_TRACKER_ACCESS_TOKEN");
export const courseTrackerMcpToken = defineSecret("COURSE_TRACKER_MCP_TOKEN");

function requireBearerToken(expectedToken: () => string): RequestHandler {
  return (request, response, next) => {
    response.setHeader("Cache-Control", "no-store");

    const authorization = request.get("authorization");
    const provided = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : "";
    const expected = expectedToken();
    const providedBytes = Buffer.from(provided, "utf8");
    const expectedBytes = Buffer.from(expected, "utf8");

    if (
      providedBytes.length === 0 ||
      providedBytes.length !== expectedBytes.length ||
      !timingSafeEqual(providedBytes, expectedBytes)
    ) {
      response.status(401).json({ error: "Invalid access token." });
      return;
    }

    next();
  };
}

export const requireAccessToken = requireBearerToken(() => courseTrackerAccessToken.value());
export const requireMcpAccessToken = requireBearerToken(() => courseTrackerMcpToken.value());
