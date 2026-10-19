# DSH AgentLineage plugin

This package consumes independent Core and optional Learning HTTP services.
It registers tools through the installed DSH `defineTool` contract and disposes registrations
through `ctx.effect`. It depends only on the `tools` service at runtime.

| Configuration | Default |
|---|---|
| coreUrl | http://127.0.0.1:8110 |
| tokenEnv | AGENTLINEAGE_TOKEN |
| learningUrl | unset; no Learning tools |
| learningTokenEnv | AGENTLINEAGE_LEARNING_TOKEN |
| enableInvestigations | false |

The configured token environment variable must exist. Tokens do not appear in tool output,
Viewer links or plugin configuration. Remote URLs require HTTPS; redirects are refused.
No publication credential is read by this plugin.

Core tools: lineage_query, lineage_open, lineage_check.
Learning tools when configured: lineage_cases, lineage_memory_search.
An explicitly enabled lineage_investigate submits uploaded **Learning source IDs**, a triage
plan and a budget. It does not receive local filesystem paths, executor commands or credentials.
Material upload uses the services' explicit HTTP/CLI entrypoints.

`npm ci --ignore-scripts && npm run check && npm pack --ignore-scripts`.
The package includes its Cordis insertion patch; install the tarball through your DSH
bundle/plugin workflow. Peer versions are pinned to DSH 0.2.1-rc.2 and Cordis 4.0.5.
The previous 0.1.6-alpha.1 peers are rejected by the current DSH installer; no compatibility
exemption is needed with this revision. The context-insight acceptance record covers clean
Profile installation, composition, startup and success/failure tool dispatch using the actual tgz.
An LLM-driven user task, automatic session capture and live-host binary upgrade remain outside
this validation. Learning remains optional and is disabled unless configured.

Tests use real DSH tool definitions and a separately launched Python Core. They do not run a model.
The HTTP integration test also mounts the plugin in the real Cordis/DSH ToolRuntime and checks
success, failure, disposal and reloading without stale registrations.
Set AGENTLINEAGE_TEST_PYTHON to the Python executable containing agentlineage-core; otherwise tests
use the repository .venv. Publication of the npm package is disabled via private:true.
