/**
 * Only same-site paths from a fixed allowlist may be used as a post-login destination.
 * Blocks open redirects such as //evil.com, /\evil.com, https://evil.com, javascript:, encoded tricks.
 */
const ALLOWED_PREFIXES = ["/account", "/business", "/admin", "/directory", "/guides", "/groceries", "/events", "/community"];

export function safeNext(raw: string | null | undefined, fallback = "/account"): string {
  if (!raw || raw.length > 200) return fallback;
  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch { return fallback; }
  for (const v of [raw, decoded]) {
    if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\") || /[\u0000-\u001f\s]/.test(v) || v.includes("://")) {
      return fallback;
    }
  }
  const path = raw.split(/[?#]/)[0];
  if (path.includes("//") || path.includes("@")) return fallback;
  if (path === "/") return "/";
  const ok = ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
  return ok ? raw : fallback;
}

/** CSRF defence for cookie-authenticated POST routes: Origin must match this site's own origin. */
export function sameOrigin(requestUrl: string, originHeader: string | null): boolean {
  if (!originHeader) return false;
  try { return new URL(originHeader).origin === new URL(requestUrl).origin; } catch { return false; }
}
