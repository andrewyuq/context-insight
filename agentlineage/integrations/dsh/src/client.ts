export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export class LineageClient {
  readonly baseUrl: string;
  constructor(baseUrl: string, private readonly token?: string) {
    const url = new URL(baseUrl);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/")
      throw new Error("Service URL must be an origin without credentials, query or path");
    const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(local && url.protocol === "http:"))
      throw new Error("Remote service requires HTTPS");
    this.baseUrl = url.origin;
  }

  async request(path: string, body?: unknown, signal?: AbortSignal): Promise<JsonValue> {
    if (!path.startsWith("/v1/") || path.includes("\\") || new URL(path, this.baseUrl).origin !== this.baseUrl)
      throw new Error("Invalid API path");
    const timeout = AbortSignal.timeout(30_000);
    const response = await fetch(this.baseUrl + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { ...(this.token ? { Authorization: "Bearer " + this.token } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      redirect: "error",
    });
    if (!response.ok) throw new Error("AgentLineage request failed (HTTP " + response.status + ")");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Missing response body");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 8 * 1024 * 1024) throw new Error("Response exceeds 8 MiB; paginate query");
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as JsonValue;
  }
}
