"use client";
import { createBrowserClient } from "@supabase/ssr";

/** Browser client for sign-in buttons and MFA enrollment (publishable key only). */
export function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Sign-in is not configured");
  return createBrowserClient(url, key);
}
