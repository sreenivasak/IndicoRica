import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { z } from "zod";
import type { AdminStatus, ApiError, FavoriteList, HealthResponse, MeResponse, SystemInfoResponse } from "@indicorica/contracts";
import { selectRepo, validateEnv, type Env } from "./settings";
import { bearer, defaultAuthDeps, type AuthDeps, type Identity } from "./auth";

type Vars = { requestId: string; identity: Identity };
type Ctx = Context<{ Bindings: Env; Variables: Vars }>;

const STAFF_ROLES = ["contributor", "editor", "ad_manager", "content_admin", "super_admin"];
const uuid = z.string().uuid();

export function createApp(depsOverride?: AuthDeps) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>();
  const err = (c: Ctx, status: 400 | 401 | 403 | 404 | 500 | 503, code: string, message: string) =>
    c.json<ApiError>({ error: { code, message, requestId: c.get("requestId") } }, status);
  const deps = (c: Ctx) => depsOverride ?? defaultAuthDeps(c.env ?? {});

  app.use("*", async (c, next) => {
    const requestId = crypto.randomUUID();
    c.set("requestId", requestId);
    const start = Date.now();
    await next();
    // Never log headers, tokens or query strings.
    console.log(JSON.stringify({ level: "info", requestId, method: c.req.method,
      path: new URL(c.req.url).pathname, status: c.res.status, ms: Date.now() - start }));
  });

  app.use("*", secureHeaders({ crossOriginResourcePolicy: "cross-origin", xFrameOptions: "DENY",
    strictTransportSecurity: "max-age=31536000; includeSubDomains" }));

  // Restricted CORS: only origins in ALLOWED_ORIGINS. Auth uses Authorization headers (no cookies),
  // so credentials are NOT allowed cross-origin and this API is not exposed to CSRF.
  app.use("/api/*", (c, next) => {
    const allowed = (c.env?.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    return cors({
      origin: (origin) => (allowed.includes(origin) ? origin : null),
      allowMethods: ["GET", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Authorization", "Content-Type"],
      maxAge: 600,
    })(c, next);
  });

  // Auth guard for /me and /admin: verifies the token with Supabase on every request.
  const authGuard = async (c: Ctx, next: () => Promise<void>) => {
    if (c.req.method === "OPTIONS") return next();
    const d = deps(c);
    if (!d) return err(c, 503, "auth_unavailable", "Authentication is not configured");
    const token = bearer(c.req.header("Authorization"));
    if (!token) return err(c, 401, "unauthenticated", "Sign in required");
    const who = await d.verify(token);
    if (!who) return err(c, 401, "unauthenticated", "Session is invalid or expired");
    c.set("identity", { ...who, token });
    await next();
  };
  app.use("/api/v1/me", authGuard);
  app.use("/api/v1/me/*", authGuard);
  app.use("/api/v1/admin/*", authGuard);

  app.get("/api/v1/health", (c) => (validateEnv(c.env ?? {}), c.json<HealthResponse>({ status: "ok", time: new Date().toISOString() })));

  app.get("/api/v1/public/system-info", async (c) => {
    const repo = selectRepo(c.env ?? {});
    const name = await repo.getPublicSetting("site_name");
    if (!name) return err(c, 404, "not_found", "site_name not configured");
    return c.json<SystemInfoResponse>({
      siteName: name, dataSource: repo.source, isRealDatabase: repo.source === "supabase", apiVersion: "v1",
    });
  });

  app.get("/api/v1/me", async (c) => {
    const id = c.get("identity");
    const roles = await deps(c)!.roles(id.token);
    return c.json<MeResponse>({ user: { id: id.id, email: id.email }, roles, aal: id.aal });
  });

  app.get("/api/v1/me/favorites", async (c) =>
    c.json<FavoriteList>({ favorites: await deps(c)!.favorites.list(c.get("identity").token) }));

  app.put("/api/v1/me/favorites/:businessId", async (c) => {
    const parsed = uuid.safeParse(c.req.param("businessId"));
    if (!parsed.success) return err(c, 400, "invalid_id", "businessId must be a UUID");
    await deps(c)!.favorites.add(c.get("identity").token, parsed.data);
    return c.body(null, 204);
  });

  app.delete("/api/v1/me/favorites/:businessId", async (c) => {
    const parsed = uuid.safeParse(c.req.param("businessId"));
    if (!parsed.success) return err(c, 400, "invalid_id", "businessId must be a UUID");
    await deps(c)!.favorites.remove(c.get("identity").token, parsed.data);
    return c.body(null, 204);
  });

  // Privileged area: needs a staff role AND an MFA-verified session. Checked here and again by the database.
  app.get("/api/v1/admin/status", async (c) => {
    const id = c.get("identity");
    const roles = (await deps(c)!.roles(id.token)).filter((r) => STAFF_ROLES.includes(r));
    if (roles.length === 0) return err(c, 403, "forbidden", "This area is for staff");
    if (id.aal !== "aal2") return err(c, 403, "mfa_required", "Complete two-factor sign-in to use the admin area");
    return c.json<AdminStatus>({ roles, mfaVerified: true });
  });

  app.notFound((c) => err(c, 404, "not_found", "Route not found"));
  app.onError((e, c) => {
    console.error(JSON.stringify({ level: "error", requestId: c.get("requestId"), message: e.message }));
    return err(c, 500, "internal_error", "Unexpected server error");
  });

  return app;
}

export default createApp();
