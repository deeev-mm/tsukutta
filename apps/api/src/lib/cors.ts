import type { Context, Next } from "hono";
import type { Env } from "./crypto";

export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return ["http://localhost:3000"];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function corsMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next,
) {
  const origin = c.req.header("Origin") ?? "";
  const allowed = parseAllowedOrigins(c.env.CORS_ALLOWED_ORIGINS);
  const ok = allowed.includes(origin);

  if (c.req.method === "OPTIONS") {
    const res = new Response(null, { status: 204 });
    if (ok) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Access-Control-Allow-Credentials", "true");
      res.headers.set(
        "Access-Control-Allow-Methods",
        "GET,POST,PATCH,PUT,DELETE,OPTIONS",
      );
      res.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Groq-Api-Key",
      );
      res.headers.set("Access-Control-Max-Age", "86400");
      res.headers.set("Vary", "Origin");
    }
    return res;
  }

  await next();

  if (ok) {
    c.res.headers.set("Access-Control-Allow-Origin", origin);
    c.res.headers.set("Access-Control-Allow-Credentials", "true");
    c.res.headers.set("Vary", "Origin");
  }
}
