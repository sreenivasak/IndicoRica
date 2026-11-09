import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiFavorites, apiMe, requireUser } from "../../lib/session";
import { supabaseServer } from "../../lib/supabase";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your account — IndicoRica", robots: { index: false } };

const NameSchema = z.string().trim().min(1).max(80);

async function saveName(formData: FormData) {
  "use server";
  const parsed = NameSchema.safeParse(formData.get("display_name"));
  if (!parsed.success) return;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  // Runs with the member's own session: RLS only lets them update their own profile row.
  await sb.from("profiles").update({ display_name: parsed.data }).eq("id", user.id);
  revalidatePath("/account");
}

export default async function Account() {
  const u = await requireUser("/account");
  const sb = await supabaseServer();
  const [me, favs, profile] = await Promise.all([
    apiMe(u.token), apiFavorites(u.token),
    sb.from("profiles").select("display_name").eq("id", u.userId).maybeSingle(),
  ]);
  const staff = me.ok && me.data.roles.length > 0;

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-6 py-10">
      <h1 className="text-3xl font-bold">Your account</h1>

      <section className="rounded-xl border border-amber-200 bg-white p-5">
        <h2 className="font-semibold">Profile</h2>
        <p className="mt-1 text-sm text-stone-600">Signed in as {u.email ?? "your account"}.</p>
        <form action={saveName} className="mt-4 flex gap-2">
          <label htmlFor="display_name" className="sr-only">Display name</label>
          <input id="display_name" name="display_name" defaultValue={profile.data?.display_name ?? ""} maxLength={80} required
            className="flex-1 rounded border border-stone-300 px-3 py-2" placeholder="Name shown next to your questions" />
          <button className="rounded bg-orange-700 px-4 py-2 text-white hover:bg-orange-800">Save</button>
        </form>
        <p className="mt-2 text-xs text-stone-500">Only this display name can ever be shown publicly, and only next to posts that were approved.</p>
      </section>

      <section className="rounded-xl border border-amber-200 bg-white p-5">
        <h2 className="font-semibold">Saved businesses</h2>
        {!favs.ok ? <p role="alert" className="mt-2 text-sm text-red-700">{favs.message}</p>
          : favs.data.favorites.length === 0 ? <p className="mt-2 text-sm text-stone-600">Nothing saved yet.</p>
          : <ul className="mt-2 list-disc pl-5 text-sm">{favs.data.favorites.map((f) => <li key={f.businessId}>{f.name ?? "Unavailable listing"}</li>)}</ul>}
      </section>

      <section className="rounded-xl border border-amber-200 bg-white p-5">
        <h2 className="font-semibold">Security</h2>
        <p className="mt-1 text-sm text-stone-700">
          {staff ? "Your account has staff access, so two-factor sign-in with an authenticator app is required."
                 : "Optional: protect your account with an authenticator app."}
        </p>
        <a href="/account/security" className="mt-3 inline-block rounded border border-stone-300 px-4 py-2 text-sm hover:bg-stone-50">Manage two-factor sign-in</a>
        {staff && <a href="/admin" className="ml-3 inline-block rounded bg-stone-800 px-4 py-2 text-sm text-white">Open admin</a>}
      </section>

      <section className="rounded-xl border border-amber-200 bg-white p-5">
        <h2 className="font-semibold">Privacy</h2>
        <p className="mt-1 text-sm text-stone-700">
          To delete your account and personal data, email the site owner from the address you signed in with.
          (Self-service deletion needs a privileged server step and is not built yet.)
        </p>
      </section>
    </main>
  );
}
