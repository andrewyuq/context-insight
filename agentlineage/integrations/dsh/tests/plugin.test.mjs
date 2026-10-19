import assert from "node:assert/strict";
import test from "node:test";
import { createTools, apply, inject } from "../dist/plugin.js";
import { LineageClient } from "../dist/client.js";

test("actual DSH defineTool validates tools; writes require explicit configuration", async () => {
  const calls = [];
  const client = { baseUrl: "http://127.0.0.1:8110",
    request: async (...args) => { calls.push(args); return { ok: true }; } };
  const tools = createTools(client, client);
  assert.deepEqual(tools.map(t => t.name), ["lineage_query", "lineage_open", "lineage_check",
    "lineage_memory_search", "lineage_cases"]);
  const query = tools[0];
  await query.execute({ snapshot_id: "snapshot", requests: [{ op: "file" }] },
    { signal: new AbortController().signal });
  assert.equal(calls[0][0], "/v1/query");
  assert.equal(createTools(client, client, true).at(-1).name, "lineage_investigate");
});

test("registration has effect-owned disposal and depends only on tools", () => {
  process.env.LINEAGE_TEST_TOKEN = "fixture";
  const registered = [], disposers = [];
  apply({ effect: fn => disposers.push(fn()), tools: {
    register: tool => { registered.push(tool.name); return () => registered.splice(registered.indexOf(tool.name), 1); }
  } }, { coreUrl: "http://127.0.0.1:8110", tokenEnv: "LINEAGE_TEST_TOKEN" });
  assert.equal(registered.length, 3);
  for (const dispose of disposers) dispose();
  assert.equal(registered.length, 0);
  assert.deepEqual(inject, ["tools"]);
  delete process.env.LINEAGE_TEST_TOKEN;
});

test("credential-bearing clients reject unsafe endpoints", () => {
  for (const url of ["http://remote.example", "https://u:p@remote.example", "https://host/path"])
    assert.throws(() => new LineageClient(url, "secret"));
});
