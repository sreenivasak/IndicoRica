import { requireUser } from "../../../lib/session";
import MfaPanel from "./MfaPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Two-factor sign-in — IndicoRica", robots: { index: false } };

export default async function Security({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await requireUser("/account/security");
  const sp = await searchParams;
  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-3xl font-bold">Two-factor sign-in</h1>
      <p className="mt-2 text-stone-700">Use an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password…).</p>
      <MfaPanel next={sp.next === "/admin" ? "/admin" : "/account"} />
    </main>
  );
}
