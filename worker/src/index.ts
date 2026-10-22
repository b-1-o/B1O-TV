type Role = "system" | "user" | "assistant";

interface ChatMessage {
  role: Role;
  content: string;
}

interface AIBinding {
  run(
    model: string,
    input: {
      messages: ChatMessage[];
      max_tokens: number;
      temperature: number;
    },
  ): Promise<unknown>;
}

interface Env {
  AI: AIBinding;
  ASSISTANT_TOKEN?: string;
  AI_MODEL?: string;
}

const SYSTEM_PROMPT = [
  "You are B1O Assistant, a friendly general-purpose TV companion.",
  "Reply in the language used by the user; Russian is the default.",
  "Be concise, conversational, and useful on a television screen.",
  "You may answer questions and discuss ideas, media, technology, and everyday topics.",
  "Do not claim to have changed TV settings, launched apps, set timers, or saved memories.",
  "The client app handles those actions locally and will tell you when an action succeeds.",
  "Never ask for passwords, API keys, or private credentials.",
  "If unsure, be honest instead of inventing facts."
].join(" ");

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400"
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS
  });
}

function sameToken(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function textContent(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!Array.isArray(value)) return "";

  return value.map((part) => {
    if (typeof part === "string") return part;
    if (typeof part !== "object" || part === null) return "";
    const item = part as { text?: unknown; content?: unknown };
    if (typeof item.text === "string") return item.text;
    if (typeof item.content === "string") return item.content;
    return "";
  }).join("").trim();
}

/**
 * Workers AI can return a response field or an OpenAI-compatible choices
 * structure. Some API wrappers nest the payload inside result, so support
 * both formats without assuming one response shape.
 */
function extractAIText(value: unknown, depth = 0): string {
  if (depth > 4 || typeof value !== "object" || value === null) return "";
  const output = value as Record<string, unknown>;

  const response = textContent(output.response);
  if (response) return response;

  const outputText = textContent(output.output_text);
  if (outputText) return outputText;

  if (Array.isArray(output.choices)) {
    for (const entry of output.choices) {
      if (typeof entry !== "object" || entry === null) continue;
      const choice = entry as Record<string, unknown>;
      if (typeof choice.message === "object" && choice.message !== null) {
        const message = choice.message as Record<string, unknown>;
        const content = textContent(message.content);
        if (content) return content;
      }
      const text = textContent(choice.text);
      if (text) return text;
    }
  }

  const content = textContent(output.content);
  if (content) return content;

  return extractAIText(output.result, depth + 1);
}

function safeHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  const history: ChatMessage[] = [];
  for (const entry of value.slice(-10)) {
    if (typeof entry !== "object" || entry === null) continue;
    const item = entry as { role?: unknown; content?: unknown };
    if ((item.role !== "user" && item.role !== "assistant") || typeof item.content !== "string") continue;
    const content = item.content.trim().slice(0, 1200);
    if (content) history.push({ role: item.role, content });
  }
  return history;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: JSON_HEADERS });
    if (url.pathname === "/" && request.method === "GET") {
      return json({
        ok: true,
        service: "B1O TV Assistant",
        endpoints: { health: "/health", assistant: "/api/assistant" }
      });
    }
    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, service: "B1O TV Assistant" });
    }
    if (url.pathname !== "/api/assistant") return json({ error: "Not found" }, 404);
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const expectedToken = env.ASSISTANT_TOKEN;
    if (!expectedToken || expectedToken.length < 24) {
      return json({ error: "Assistant is not configured. Set the ASSISTANT_TOKEN secret." }, 503);
    }
    const authorization = request.headers.get("Authorization") || "";
    if (!sameToken(authorization, "Bearer " + expectedToken)) {
      return json({ error: "Unauthorized" }, 401);
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Body must be valid JSON." }, 400);
    }
    if (typeof payload !== "object" || payload === null) return json({ error: "Body must be a JSON object." }, 400);

    const body = payload as { message?: unknown; history?: unknown };
    if (typeof body.message !== "string" || !body.message.trim()) {
      return json({ error: "A non-empty message is required." }, 400);
    }
    const message = body.message.trim().slice(0, 2_000);
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...safeHistory(body.history),
      { role: "user", content: message }
    ];

    try {
      const output = await env.AI.run(env.AI_MODEL || "@cf/zai-org/glm-4.7-flash", {
        messages,
        max_tokens: 700,
        temperature: 0.45
      });
      const reply = extractAIText(output);
      if (!reply) {
        return json({ error: "The AI model returned no readable text. Please try again." }, 502);
      }
      return json({ reply: reply.slice(0, 6_000) });
    } catch {
      // Do not expose model/provider internals or user prompts in errors.
      return json({ error: "AI is temporarily unavailable. Please try again." }, 502);
    }
  }
};
