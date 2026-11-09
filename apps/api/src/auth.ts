import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppRole } from "@indicorica/contracts";
import type { Env } from "./settings";

export interface Identity { id: string; email: string | null; aal: "aal1" | "aal2"; token: string }

/** Everything that touches Supabase on behalf of a signed-in user. Injected so tests need no network. */
export interface AuthDeps {
  verify(token: string): Promise<Omit<Identity, "token"> | null>;
  roles(token: string): Promise<AppRole[]>;
  favorites: {
    list(token: string): Promise<{ businessId: string; slug: string | null; name: string | null }[]>;
    add(token: string, businessId: string): Promise<void>;
    remove(token: string, businessId: string): Promise<void>;
  };
}

/** Reads `aal` from a JWT payload. Only call AFTER the token has been verified with Supabase. */
export function aalFromJwt(token: string): "aal1" | "aal2" {
  try {
    const p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(p.padEnd(p.length + ((4 - (p.length % 4)) % 4), "=")));
    return claims.aal === "aal2" ? "aal2" : "aal1";
  } catch {
    return "aal1";
  }
}

export function bearer(header: string | undefined): string | null {
  const m = /^Bearer ([A-Za-z0-9._~+/=-]{20,4096})$/.exec(header ?? "");
  return m ? m[1] : null;
}

function userClient(env: Env, token: string): SupabaseClient {
  // The user's own token is forwarded, so Row Level Security applies exactly as for direct access.
  return createClient(env.SUPABASE_URL!, env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export function supabaseAuthDeps(env: Env): AuthDeps {
  return {
    async verify(token) {
      const { data, error } = await userClient(env, token).auth.getUser(token); // server-side verification
      if (error || !data.user) return null;
      return { id: data.user.id, email: data.user.email ?? null, aal: aalFromJwt(token) };
    },
    async roles(token) {
      // user_roles has a "read own rows" policy that does not require MFA.
      const { data, error } = await userClient(env, token).from("user_roles").select("role");
      if (error) throw new Error(`roles: ${error.message}`);
      return (data ?? []).flatMap((r) => (AppRole.safeParse(r.role).success ? [r.role as AppRole] : []));
    },
    favorites: {
      async list(token) {
        const { data, error } = await userClient(env, token)
          .from("favorites").select("business_id, businesses(slug, name)").order("created_at", { ascending: false });
        if (error) throw new Error(`favorites: ${error.message}`);
        return (data ?? []).map((r: any) => ({
          businessId: r.business_id, slug: r.businesses?.slug ?? null, name: r.businesses?.name ?? null,
        }));
      },
      async add(token, businessId) {
        const { error } = await userClient(env, token).from("favorites").upsert({ business_id: businessId }, { ignoreDuplicates: true });
        if (error) throw new Error(`favorites: ${error.message}`);
      },
      async remove(token, businessId) {
        const { error } = await userClient(env, token).from("favorites").delete().eq("business_id", businessId);
        if (error) throw new Error(`favorites: ${error.message}`);
      },
    },
  };
}

export function defaultAuthDeps(env: Env): AuthDeps | null {
  return env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY ? supabaseAuthDeps(env) : null;
}
