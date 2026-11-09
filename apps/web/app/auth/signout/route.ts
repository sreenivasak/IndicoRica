import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "../../../lib/supabase";
import { sameOrigin } from "../../../lib/safe-redirect";

// POST only, and only from this site (Origin check) so another site cannot sign users out (CSRF).
export async function POST(request: NextRequest) {
  const origin = new URL(request.url).origin;
  if (!sameOrigin(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  }
  try { await (await supabaseServer()).auth.signOut(); } catch { /* still clear locally */ }
  return NextResponse.redirect(`${origin}/`, { status: 303 });
}
