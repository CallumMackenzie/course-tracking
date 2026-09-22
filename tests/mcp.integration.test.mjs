import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

process.env.COURSE_TRACKER_ACCESS_TOKEN = "local-web-test-token";
process.env.COURSE_TRACKER_MCP_TOKEN = "local-mcp-test-token";

let baseUrl;
let httpServer;

before(async () => {
  const { app } = await import("../dist-server/server/app.js");
  await new Promise((resolve) => {
    httpServer = app.listen(0, "127.0.0.1", () => {
      const address = httpServer.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve, reject) => {
    httpServer.close((error) => (error ? reject(error) : resolve()));
  });
});

test("MCP endpoint rejects requests without its scoped token", async () => {
  const response = await fetch(`${baseUrl}/api/mcp`, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "integration-test", version: "1.0.0" }
      }
    })
  });

  assert.equal(response.status, 401);
});

test("MCP token does not authorize the browser API", async () => {
  const response = await fetch(`${baseUrl}/api/deliverables`, {
    headers: { Authorization: "Bearer local-mcp-test-token" }
  });

  assert.equal(response.status, 401);
});

test("authorized MCP clients can discover only read-only course tools", async () => {
  const client = new Client({ name: "integration-test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/api/mcp`), {
    requestInit: {
      headers: { Authorization: "Bearer local-mcp-test-token" }
    }
  });

  await client.connect(transport);
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(
      tools.map((tool) => tool.name).sort(),
      [
        "get_assessment",
        "get_daily_schedule",
        "list_assessments",
        "list_upcoming_assessments"
      ]
    );
    assert.ok(tools.every((tool) => tool.annotations?.readOnlyHint === true));
    assert.ok(tools.every((tool) => tool.annotations?.destructiveHint === false));
  } finally {
    await client.close();
  }
});
