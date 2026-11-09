"use client";
import { useState } from "react";
import { supabaseBrowser } from "../../lib/supabase-browser";

export default function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function google() {
    setError(null); setState("busy");
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google", options: { redirectTo: callback() },
    });
    if (error) { setError("Google sign-in is not available right now. Please try email instead."); setState("idle"); }
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setState("busy");
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim(), options: { emailRedirectTo: callback(), shouldCreateUser: true },
    });
    if (error) {
      setError(error.status === 429 ? "Too many attempts. Please wait a few minutes and try again."
                                    : "We could not send the link. Check the address and try again.");
      setState("idle");
    } else setState("sent");
  }

  return (
    <div className="mt-6 space-y-6">
      <button onClick={google} disabled={state === "busy"}
        className="w-full rounded border border-stone-300 bg-white px-4 py-3 font-medium hover:bg-stone-50 disabled:opacity-60">
        Continue with Google
      </button>

      <form onSubmit={sendLink} className="space-y-3">
        <label htmlFor="email" className="block text-sm font-medium">Or continue with email</label>
        <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-stone-300 px-3 py-2" placeholder="you@example.com" />
        <button disabled={state === "busy" || !email}
          className="w-full rounded bg-orange-700 px-4 py-3 font-medium text-white hover:bg-orange-800 disabled:opacity-60">
          Email me a sign-in link
        </button>
      </form>

      {state === "sent" && (
        <p role="status" className="rounded bg-green-50 p-3 text-sm text-green-800">
          Check your inbox for a sign-in link. It works once and expires soon.
        </p>
      )}
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      <div className="rounded border border-dashed border-stone-300 p-3 text-sm text-stone-600">
        <strong>Phone sign-in</strong> — coming later. It needs a paid SMS service, so it is switched off for now.
      </div>
    </div>
  );
}
