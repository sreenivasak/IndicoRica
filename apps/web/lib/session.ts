import { redirect } from "next/navigation";
import { MeResponse, FavoriteList, AdminStatus, ApiError } from "@indicorica/contracts";
import { supabaseServer } from "./supabase";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787/api/v1";

export type Authed = { userId: string; email: string | null; token: string };

/** Returns the signed-in user (verified with Supabase, not just read from a cookie) or sends them to /login. */
export async function requireUser(next: string): Promise<Authed> {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();          // verified by Supabase
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const { data: { session } } = await sb.auth.getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { userId: user.id, email: user.email ?? null, token: session.access_token };
}

export async function currentUser() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

type ApiOk<T> = { ok: true; data: T };
type ApiFail = { ok: false; status: number; code: string; message: string };

async function call<T>(path: string, token: string, parse: (j: unknown) => T): Promise<ApiOk<T> | ApiFail> {
  try {
    const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const e = ApiError.safeParse(json);
      return { ok: false, status: res.status, code: e.success ? e.data.error.code : "error", message: e.success ? e.data.error.message : `API error ${res.status}` };
    }
    return { ok: true, data: parse(json) };
  } catch {
    return { ok: false, status: 0, code: "network", message: "Could not reach the API." };
  }
}

export const apiMe = (t: string) => call("/me", t, (j) => MeResponse.parse(j));
export const apiFavorites = (t: string) => call("/me/favorites", t, (j) => FavoriteList.parse(j));
export const apiAdminStatus = (t: string) => call("/admin/status", t, (j) => AdminStatus.parse(j));
