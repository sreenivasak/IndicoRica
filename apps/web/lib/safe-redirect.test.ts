import { describe, expect, it } from "vitest";
import { safeNext, sameOrigin } from "./safe-redirect";

describe("safeNext", () => {
  it("allows listed same-site paths, keeping their query", () => {
    expect(safeNext("/account")).toBe("/account");
    expect(safeNext("/business/dashboard")).toBe("/business/dashboard");
    expect(safeNext("/admin?tab=users")).toBe("/admin?tab=users");
    expect(safeNext("/")).toBe("/");
  });
  it("falls back for empty or missing values", () => {
    expect(safeNext(null)).toBe("/account");
    expect(safeNext("")).toBe("/account");
    expect(safeNext(undefined, "/x")).toBe("/x");
  });
  it("blocks open-redirect tricks", () => {
    const bad = [
      "//evil.com", "///evil.com", "/\\evil.com", "https://evil.com", "http://evil.com/account",
      "javascript:alert(1)", "/account//evil.com@x", "%2F%2Fevil.com", "/%2F%2Fevil.com", "/account\r\nSet-Cookie: a=b",
      "/account://x", "/unlisted-path", "/accountevil", "account", " /account", "/ac count", "/%5Cevil.com",
    ];
    for (const b of bad) expect(safeNext(b), b).toBe("/account");
  });
  it("rejects very long values", () => {
    expect(safeNext("/account?" + "a".repeat(300))).toBe("/account");
  });
});

describe("sameOrigin", () => {
  it("accepts matching origin only", () => {
    expect(sameOrigin("https://site.dev/auth/signout", "https://site.dev")).toBe(true);
    expect(sameOrigin("https://site.dev/auth/signout", "https://evil.dev")).toBe(false);
    expect(sameOrigin("https://site.dev/auth/signout", null)).toBe(false);
    expect(sameOrigin("https://site.dev/x", "null")).toBe(false);
    expect(sameOrigin("https://site.dev/x", "http://site.dev")).toBe(false);
  });
});
