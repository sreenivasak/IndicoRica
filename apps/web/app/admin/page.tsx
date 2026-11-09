import { redirect } from "next/navigation";
import { apiAdminStatus, requireUser } from "../../lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — IndicoRica", robots: { index: false, follow: false } };

export default async function Admin() {
  const u = await requireUser("/admin");
  const status = await apiAdminStatus(u.token);

  if (!status.ok) {
    if (status.code === "mfa_required") redirect("/account/security?next=/admin");
    return (
      <main className="mx-auto max-w-md px-6 py-12">
        <h1 className="text-2xl font-bold">{status.status === 403 ? "Staff only" : "Admin unavailable"}</h1>
        <p role="alert" className="mt-3 text-stone-700">
          {status.status === 403 ? "Your account does not have staff access." : status.message}
        </p>
        <a href="/" className="mt-6 inline-block underline">Back to the site</a>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold">Admin</h1>
      <p className="mt-2 text-stone-700">Signed in with two-factor verification. Your roles: <strong>{status.data.roles.join(", ")}</strong>.</p>
      <p className="mt-6 rounded-xl border border-dashed border-stone-300 p-5 text-stone-600">
        The editing screens (businesses, guides, groceries, events, ads) are built in the next phase.
        Until then, add content in the Supabase Table Editor.
      </p>
    </main>
  );
}
