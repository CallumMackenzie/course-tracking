import type { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import * as z from "zod/v4";
import { loadCourseContent } from "./course-content.js";
import { courseLinks, type CourseFile } from "./courses.js";
import { database } from "./db/database.js";
import { importAssessmentData } from "./db/seed.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const COURSE_TIME_ZONE = "America/Vancouver";
const ASSESSMENT_TYPES = [
  "assignment",
  "lab",
  "quiz",
  "test",
  "final",
  "participation"
] as const;

type Assessment = {
  id: string;
  type: (typeof ASSESSMENT_TYPES)[number];
  name: string;
  date: string | null;
  start_date: string | null;
  due_date: string | null;
  sort_date: string | null;
  points: number | null;
  grading_group: string | null;
  grading_group_worth_pct: number | null;
  worth_pct_estimated: boolean;
  course_code: string;
  course_webpage: string | null;
  course_files: CourseFile[];
  worth_pct: number;
  completed: boolean;
};

function todayInCourseTimeZone() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: COURSE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}

function effectiveDate(item: Assessment) {
  return item.due_date ?? item.date ?? item.sort_date ?? item.start_date;
}

function serializeAssessment(id: string, data: FirebaseFirestore.DocumentData): Assessment {
  return {
    id,
    type: data.type,
    name: data.name,
    date: data.date ?? null,
    start_date: data.start_date ?? null,
    due_date: data.due_date ?? null,
    sort_date: data.sort_date ?? null,
    points: data.points ?? null,
    grading_group: data.grading_group ?? null,
    grading_group_worth_pct: data.grading_group_worth_pct ?? null,
    worth_pct_estimated: data.worth_pct_estimated ?? false,
    course_code: data.course_code,
    ...courseLinks(data.course_code),
    worth_pct: data.worth_pct,
    completed: data.completed ?? false
  };
}

async function loadAssessments() {
  await importAssessmentData();
  const snapshot = await database.collection("deliverables").get();
  return snapshot.docs.map((document) => serializeAssessment(document.id, document.data()));
}

function toolResult(data: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data
  };
}

function createCourseTrackerMcpServer() {
  const server = new McpServer({ name: "callum-course-tracker", version: "1.0.0" });

  server.registerTool(
    "list_assessments",
    {
      title: "List course assessments",
      description:
        "List Callum's assessments. Filter by course, type, completion, or effective date range.",
      inputSchema: {
        course_code: z.string().min(1).optional(),
        type: z.enum(ASSESSMENT_TYPES).optional(),
        completed: z.boolean().optional(),
        from_date: z.string().regex(DATE_PATTERN).optional(),
        to_date: z.string().regex(DATE_PATTERN).optional()
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async ({ course_code, type, completed, from_date, to_date }) => {
      const assessments = (await loadAssessments())
        .filter((item) => !course_code || item.course_code === course_code)
        .filter((item) => !type || item.type === type)
        .filter((item) => completed === undefined || item.completed === completed)
        .filter((item) => {
          const date = effectiveDate(item);
          return !from_date || (date !== null && date >= from_date);
        })
        .filter((item) => {
          const date = effectiveDate(item);
          return !to_date || (date !== null && date <= to_date);
        })
        .sort((left, right) =>
          (effectiveDate(left) ?? "9999-12-31").localeCompare(
            effectiveDate(right) ?? "9999-12-31"
          ) || left.course_code.localeCompare(right.course_code)
        );

      return toolResult({ count: assessments.length, assessments });
    }
  );

  server.registerTool(
    "get_assessment",
    {
      title: "Get an assessment",
      description: "Get one assessment by its exact ID.",
      inputSchema: { id: z.string().regex(/^[A-Za-z0-9_-]{1,1500}$/) },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async ({ id }) => {
      await importAssessmentData();
      const document = await database.collection("deliverables").doc(id).get();
      if (!document.exists) {
        return {
          content: [{ type: "text" as const, text: "Assessment not found." }],
          isError: true
        };
      }
      return toolResult({ assessment: serializeAssessment(document.id, document.data()!) });
    }
  );

  server.registerTool(
    "get_daily_schedule",
    {
      title: "Get daily course schedule",
      description:
        "Get course content, readings, resources, and assessments opening or due on a date. Defaults to today in America/Vancouver.",
      inputSchema: { date: z.string().regex(DATE_PATTERN).optional() },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async ({ date }) => {
      const selectedDate = date ?? todayInCourseTimeZone();
      const [courseContent, assessments] = await Promise.all([
        loadCourseContent(selectedDate),
        loadAssessments()
      ]);
      const due = assessments.filter(
        (item) => item.due_date === selectedDate || (!item.due_date && item.date === selectedDate)
      );
      const opening = assessments.filter((item) => item.start_date === selectedDate);

      return toolResult({
        date: selectedDate,
        time_zone: COURSE_TIME_ZONE,
        course_content: courseContent,
        assessments_due: due,
        assessments_opening: opening
      });
    }
  );

  server.registerTool(
    "list_upcoming_assessments",
    {
      title: "List upcoming assessments",
      description:
        "List incomplete dated assessments, including scheduled participation, in an upcoming date window.",
      inputSchema: {
        start_date: z.string().regex(DATE_PATTERN).optional(),
        days: z.number().int().min(1).max(90).default(7),
        course_code: z.string().min(1).optional()
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async ({ start_date, days, course_code }) => {
      const fromDate = start_date ?? todayInCourseTimeZone();
      const toDate = addDays(fromDate, days - 1);
      const assessments = (await loadAssessments())
        .filter((item) => !item.completed && (item.type !== "participation" || item.due_date || item.date))
        .filter((item) => !course_code || item.course_code === course_code)
        .filter((item) => {
          const date = effectiveDate(item);
          return date !== null && date >= fromDate && date <= toDate;
        })
        .sort((left, right) =>
          (effectiveDate(left) ?? "").localeCompare(effectiveDate(right) ?? "")
        );

      return toolResult({
        from_date: fromDate,
        to_date: toDate,
        count: assessments.length,
        assessments
      });
    }
  );

  return server;
}

export async function handleMcpRequest(request: Request, response: Response) {
  const server = createCourseTrackerMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(request, response, request.body);
  } catch (error) {
    console.error("MCP request failed", error);
    if (!response.headersSent) {
      response.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null
      });
    }
  } finally {
    await transport.close();
    await server.close();
  }
}
