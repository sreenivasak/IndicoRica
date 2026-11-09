import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "../../../lib/supabase";
import { safeNext } from "../../../lib/safe-redirect";

// Completes Google / email-link sign-in (PKCE): swaps the one-time code for a session cookie.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  if (code) {
    try {
      const { error } = await (await supabaseServer()).auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${origin}${next}`);
    } catch { /* fall through */ }
  }
  return NextResponse.redirect(`${origin}/login?error=callback`);
}
