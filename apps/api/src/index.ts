import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ApiError, HealthResponse, SystemInfoResponse } from "@indicorica/contracts";
import { selectRepo, type Env } from "./settings";

type Vars = { requestId: string };

export function createApp() {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>();

  app.use("*", async (c, next) => {
    const requestId = crypto.randomUUID();
    c.set("requestId", requestId);
    const start = Date.now();
    await next();
    console.log(JSON.stringify({ level: "info", requestId, method: c.req.method,
      path: new URL(c.req.url).pathname, status: c.res.status, ms: Date.now() - start }));
  });

  // Restricted CORS: only origins listed in ALLOWED_ORIGINS get CORS headers. No wildcard, no credentials yet.
  app.use("/api/*", (c, next) => {
    const allowed = (c.env?.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    return cors({
      origin: (origin) => (allowed.includes(origin) ? origin : null),
      allowMethods: ["GET", "OPTIONS"],
      maxAge: 600,
    })(c, next);
  });

  app.get("/api/v1/health", (c) => c.json<HealthResponse>({ status: "ok", time: new Date().toISOString() }));

  app.get("/api/v1/public/system-info", async (c) => {
    const repo = selectRepo(c.env ?? {});
    const name = await repo.getPublicSetting("site_name");
    if (!name) {
      return c.json<ApiError>({ error: { code: "not_found", message: "site_name not configured", requestId: c.get("requestId") } }, 404);
    }
    return c.json<SystemInfoResponse>({
      siteName: name, dataSource: repo.source, isRealDatabase: repo.source === "supabase", apiVersion: "v1",
    });
  });

  app.notFound((c) => c.json<ApiError>({ error: { code: "not_found", message: "Route not found", requestId: c.get("requestId") } }, 404));
  app.onError((err, c) => {
    console.error(JSON.stringify({ level: "error", requestId: c.get("requestId"), message: err.message }));
    return c.json<ApiError>({ error: { code: "internal_error", message: "Unexpected server error", requestId: c.get("requestId") } }, 500);
  });

  return app;
}

export default createApp();
