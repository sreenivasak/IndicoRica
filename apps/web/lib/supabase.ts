import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Public values by design (RLS-restricted publishable key). The service-role key is never used here.
export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required");
  return { url, key };
}

/** Server-side client bound to the visitor's session cookies (Server Components, route handlers, actions). */
export async function supabaseServer() {
  const { url, key } = supabaseConfig();
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        // Server Components cannot set cookies; the proxy refreshes the session instead.
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* ignore */ }
      },
    },
  });
}
