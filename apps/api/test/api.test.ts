import { describe, expect, it } from "vitest";
import { SystemInfoResponse } from "@indicorica/contracts";
import { createApp } from "../src/index";

const env = { DATA_SOURCE: "mock", ALLOWED_ORIGINS: "http://localhost:3000" };
const app = createApp();
const get = (path: string, origin?: string, e: object = env) =>
  app.request(path, { headers: origin ? { Origin: origin } : {} }, e);

describe("api v1", () => {
  it("health ok", async () => {
    expect((await get("/api/v1/health")).status).toBe(200);
  });
  it("system-info matches contract and is labelled mock", async () => {
    const body = SystemInfoResponse.parse(await (await get("/api/v1/public/system-info")).json());
    expect(body.dataSource).toBe("mock");
    expect(body.isRealDatabase).toBe(false);
  });
  it("CORS allows configured origin", async () => {
    const r = await get("/api/v1/health", "http://localhost:3000");
    expect(r.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
  });
  it("CORS rejects unauthorized origin", async () => {
    const r = await get("/api/v1/health", "https://evil.example");
    expect(r.headers.get("access-control-allow-origin")).toBeNull();
  });
  it("unknown route returns structured error", async () => {
    const r = await get("/api/v1/nope");
    expect(r.status).toBe(404);
    expect(((await r.json()) as any).error.code).toBe("not_found");
  });
  it("unset DATA_SOURCE fails closed (no silent mock)", async () => {
    const r = await get("/api/v1/public/system-info", undefined, {});
    expect(r.status).toBe(500);
  });
  it("health fails on bad config and on placeholder values", async () => {
    expect((await get("/api/v1/health", undefined, {})).status).toBe(500);
    const p = { DATA_SOURCE: "supabase", SUPABASE_URL: "https://REPLACE-ME.supabase.co", SUPABASE_PUBLISHABLE_KEY: "k" };
    expect((await get("/api/v1/health", undefined, p)).status).toBe(500);
  });
  it("sends security headers", async () => {
    const r = await get("/api/v1/health");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
  });
  it("supabase mode without config returns structured 500", async () => {
    const r = await get("/api/v1/public/system-info", undefined, { DATA_SOURCE: "supabase" });
    expect(r.status).toBe(500);
    expect(((await r.json()) as any).error.code).toBe("internal_error");
  });
});
