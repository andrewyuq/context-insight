import type { Context } from "@deepseek-ai/cordis";
import { defineTool, type ToolDefinition } from "@deepseek-ai/dsh-tools";
import Schema from "@deepseek-ai/schemastery";
import { LineageClient, type JsonValue } from "./client.js";

export const name = "dsh-agentlineage";
export const inject = ["tools"];
export interface Config {
  coreUrl: string;
  tokenEnv: string;
  learningUrl?: string;
  learningTokenEnv?: string;
  enableInvestigations?: boolean;
}
export const Config = Schema.object({
  coreUrl: Schema.string().default("http://127.0.0.1:8110"),
  tokenEnv: Schema.string().default("AGENTLINEAGE_TOKEN"),
  learningUrl: Schema.string(),
  learningTokenEnv: Schema.string().default("AGENTLINEAGE_LEARNING_TOKEN"),
  enableInvestigations: Schema.boolean().default(false),
});
const output = {
  schema: { type: "json" as const },
  render: (_args: unknown, value: JsonValue) => [{ type: "text" as const, text: JSON.stringify(value) }],
};

export function createTools(core: LineageClient, learning?: LineageClient,
                            allowInvestigations = false): ToolDefinition[] {
  const tools: ToolDefinition[] = [
    defineTool({
      name: "lineage_query",
      description: "Query a frozen native-session snapshot. Requests use Core native inquiry operations; tool receipts establish observed effects, not semantic causality.",
      parameters: { snapshot_id: { type: "string", required: true },
        requests: { type: "array", items: { type: "json" }, required: true } },
      output, isConcurrencySafe: () => true,
      execute: (args, exec) => core.request("/v1/query", args, exec.signal),
    }),
    defineTool({
      name: "lineage_open",
      description: "Return a Viewer link for an existing snapshot. Authentication stays in the browser login.",
      parameters: { snapshot_id: { type: "string", required: true } },
      output, isConcurrencySafe: () => true,
      execute: async (args, exec) => {
        await core.request("/v1/snapshots/" + encodeURIComponent(args.snapshot_id), undefined, exec.signal);
        return { snapshot_id: args.snapshot_id,
          url: core.baseUrl + "/v1/snapshots/" + encodeURIComponent(args.snapshot_id) + "/viewer" };
      },
    }),
    defineTool({
      name: "lineage_check",
      description: "Mechanically check evidence references and relations in a report; success does not establish semantic correctness.",
      parameters: { snapshot_id: { type: "string", required: true },
        document: { type: "json", required: true } },
      output, isConcurrencySafe: () => true,
      execute: (args, exec) => core.request("/v1/reports/check", args, exec.signal),
    }),
  ];
  if (learning) {
    tools.push(defineTool({
      name: "lineage_memory_search", description: "Retrieve versioned lessons using lexical search.",
      parameters: { query: { type: "string", required: true },
        topic: { type: "string" } },
      output, isConcurrencySafe: () => true,
      execute: (args, exec) => learning.request("/v1/memory/search", args, exec.signal),
    }), defineTool({
      name: "lineage_cases", description: "Read an investigation and its mechanically checked draft cases.",
      parameters: { investigation_id: { type: "string", required: true } },
      output, isConcurrencySafe: () => true,
      execute: (args, exec) => learning.request("/v1/investigations/" +
        encodeURIComponent(args.investigation_id), undefined, exec.signal),
    }));
    if (allowInvestigations) tools.push(defineTool({
      name: "lineage_investigate",
      description: "Explicitly queue a budgeted investigation from previously uploaded native sources and a triage plan. Returns draft cases; never publishes memory.",
      parameters: { run_key: { type: "string", required: true },
        source_ids: { type: "array", items: { type: "string" }, required: true },
        triage: { type: "json", required: true }, budget: { type: "json", required: true } },
      output, isConcurrencySafe: () => false,
      execute: (args, exec) => learning.request("/v1/investigations", args, exec.signal),
    }));
  }
  return tools;
}

export function apply(ctx: Context, config: Config): void {
  const credential = (name: string): string => {
    const token = process.env[name];
    if (!token) throw new Error("Required service token environment variable is missing: " + name);
    return token;
  };
  const core = new LineageClient(config.coreUrl, credential(config.tokenEnv));
  const learning = config.learningUrl ? new LineageClient(config.learningUrl,
    credential(config.learningTokenEnv ?? "AGENTLINEAGE_LEARNING_TOKEN")) : undefined;
  for (const tool of createTools(core, learning, config.enableInvestigations))
    ctx.effect(() => ctx.tools.register(tool));
}
