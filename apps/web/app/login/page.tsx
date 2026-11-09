import { redirect } from "next/navigation";
import { safeNext } from "../../lib/safe-redirect";
import { currentUser } from "../../lib/session";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in — IndicoRica", robots: { index: false } };

const MESSAGES: Record<string, string> = {
  callback: "That sign-in link did not work or has expired. Please try again.",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  let user = null;
  try { user = await currentUser(); } catch { /* not configured */ }
  if (user) redirect(next);

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="text-3xl font-bold">Sign in</h1>
      <p className="mt-2 text-stone-700">You can browse IndicoRica without an account. Sign in to save favorites, ask questions or manage a business.</p>
      {sp.error && <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-800">{MESSAGES[sp.error] ?? "Sign-in failed. Please try again."}</p>}
      <LoginForm next={next} />
      <p className="mt-8 text-sm"><a href="/" className="underline">Continue as guest</a></p>
    </main>
  );
}
