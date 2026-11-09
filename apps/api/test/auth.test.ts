import { describe, expect, it } from "vitest";
import { AdminStatus, MeResponse } from "@indicorica/contracts";
import { createApp } from "../src/index";
import { aalFromJwt, bearer, type AuthDeps } from "../src/auth";

const ENV = { DATA_SOURCE: "mock", ALLOWED_ORIGINS: "https://web.example" };
const U1 = "11111111-1111-4111-8111-111111111111";
const B1 = "22222222-2222-4222-8222-222222222222";

const jwt = (claims: object) => `h.${btoa(JSON.stringify(claims)).replace(/=+$/, "")}.s`;
const TOK = { member: "member-token-0000000000", editor1: "editor-aal1-token-000000", editor2: "editor-aal2-token-000000" };

function fakeDeps(): AuthDeps & { calls: string[]; favs: Set<string> } {
  const favs = new Set<string>();
  const calls: string[] = [];
  const people: Record<string, { aal: "aal1" | "aal2"; roles: any[] }> = {
    [TOK.member]: { aal: "aal1", roles: [] },
    [TOK.editor1]: { aal: "aal1", roles: ["editor"] },
    [TOK.editor2]: { aal: "aal2", roles: ["editor"] },
  };
  return {
    calls, favs,
    async verify(t) { const p = people[t]; return p ? { id: U1, email: "a@b.test", aal: p.aal } : null; },
    async roles(t) { return people[t]?.roles ?? []; },
    favorites: {
      async list() { return [...favs].map((businessId) => ({ businessId, slug: "demo", name: "Demo" })); },
      async add(_t, id) { calls.push("add"); favs.add(id); },
      async remove(_t, id) { calls.push("remove"); favs.delete(id); },
    },
  };
}

const call = (app: ReturnType<typeof createApp>, path: string, init: RequestInit = {}, token?: string) =>
  app.request(path, { ...init, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) } }, ENV);

describe("auth guard", () => {
  const app = createApp(fakeDeps());
  it("rejects missing, malformed and unknown tokens with 401", async () => {
    for (const path of ["/api/v1/me", "/api/v1/me/favorites", "/api/v1/admin/status"]) {
      expect((await call(app, path)).status).toBe(401);
      expect((await call(app, path, {}, "short")).status).toBe(401);
      expect((await call(app, path, {}, "unknown-token-0000000000")).status).toBe(401);
    }
  });
  it("401 body is a structured error and leaks nothing", async () => {
    const r = await call(app, "/api/v1/me");
    const body = await r.json() as any;
    expect(body.error.code).toBe("unauthenticated");
    expect(JSON.stringify(body)).not.toMatch(/supabase|token/i);
  });
  it("returns 503 when auth is not configured at all", async () => {
    const r = await createApp().request("/api/v1/me", { headers: { Authorization: `Bearer ${TOK.member}` } }, ENV);
    expect(r.status).toBe(503);
  });
  it("only Bearer tokens are accepted (cookies are ignored: no CSRF surface)", async () => {
    const r = await app.request("/api/v1/me", { headers: { Cookie: `sb-access-token=${TOK.member}` } }, ENV);
    expect(r.status).toBe(401);
  });
});

describe("/me and favorites", () => {
  it("returns the caller's identity and roles", async () => {
    const app = createApp(fakeDeps());
    const body = MeResponse.parse(await (await call(app, "/api/v1/me", {}, TOK.editor2)).json());
    expect(body.roles).toEqual(["editor"]);
    expect(body.aal).toBe("aal2");
  });
  it("saves, lists and removes favorites; rejects non-UUID ids", async () => {
    const d = fakeDeps(); const app = createApp(d);
    expect((await call(app, `/api/v1/me/favorites/${B1}`, { method: "PUT" }, TOK.member)).status).toBe(204);
    const list = await (await call(app, "/api/v1/me/favorites", {}, TOK.member)).json() as any;
    expect(list.favorites[0].businessId).toBe(B1);
    expect((await call(app, `/api/v1/me/favorites/${B1}`, { method: "DELETE" }, TOK.member)).status).toBe(204);
    expect(d.favs.size).toBe(0);
    expect((await call(app, "/api/v1/me/favorites/not-a-uuid", { method: "PUT" }, TOK.member)).status).toBe(400);
  });
});

describe("/admin/status", () => {
  const app = createApp(fakeDeps());
  it("non-staff gets 403 forbidden", async () => {
    const r = await call(app, "/api/v1/admin/status", {}, TOK.member);
    expect(r.status).toBe(403);
    expect(((await r.json()) as any).error.code).toBe("forbidden");
  });
  it("staff without MFA gets 403 mfa_required", async () => {
    const r = await call(app, "/api/v1/admin/status", {}, TOK.editor1);
    expect(r.status).toBe(403);
    expect(((await r.json()) as any).error.code).toBe("mfa_required");
  });
  it("staff with MFA gets in", async () => {
    const r = await call(app, "/api/v1/admin/status", {}, TOK.editor2);
    expect(r.status).toBe(200);
    expect(AdminStatus.parse(await r.json()).roles).toEqual(["editor"]);
  });
});

describe("CORS for authenticated routes", () => {
  const app = createApp(fakeDeps());
  const preflight = (origin: string) => app.request("/api/v1/me/favorites/" + B1, {
    method: "OPTIONS",
    headers: { Origin: origin, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "authorization" },
  }, ENV);
  it("allows the web origin, with Authorization, and never allows credentials", async () => {
    const r = await preflight("https://web.example");
    expect(r.headers.get("access-control-allow-origin")).toBe("https://web.example");
    expect(r.headers.get("access-control-allow-headers")?.toLowerCase()).toContain("authorization");
    expect(r.headers.get("access-control-allow-credentials")).toBeNull();
  });
  it("rejects other origins", async () => {
    expect((await preflight("https://evil.example")).headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("helpers", () => {
  it("bearer() accepts only well-formed Bearer headers", () => {
    expect(bearer("Bearer abcdefghijklmnopqrstuvwxyz")).toBe("abcdefghijklmnopqrstuvwxyz");
    for (const bad of [undefined, "", "Basic abcdefghijklmnopqrstuvwxyz", "Bearer short", "Bearer a b c d e f g h i j k l m n o p"])
      expect(bearer(bad as any)).toBeNull();
  });
  it("aalFromJwt() trusts only an explicit aal2", () => {
    expect(aalFromJwt(jwt({ aal: "aal2" }))).toBe("aal2");
    expect(aalFromJwt(jwt({ aal: "aal1" }))).toBe("aal1");
    expect(aalFromJwt(jwt({}))).toBe("aal1");
    expect(aalFromJwt("garbage")).toBe("aal1");
  });
});
