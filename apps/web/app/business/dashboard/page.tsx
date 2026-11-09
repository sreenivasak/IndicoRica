import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "../../../lib/session";
import { supabaseServer } from "../../../lib/supabase";

export const dynamic = "force-dynamic";
export const metadata = { title: "My business — IndicoRica", robots: { index: false } };

const ClaimSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  note: z.string().trim().max(1000).optional(),
});

async function requestClaim(formData: FormData) {
  "use server";
  const parsed = ClaimSchema.safeParse({ slug: formData.get("slug"), note: formData.get("note") || undefined });
  if (!parsed.success) return;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  const { data: biz } = await sb.from("businesses").select("id").eq("slug", parsed.data.slug).maybeSingle();
  if (!biz) return;
  // Always filed as PENDING (the database forces it). Only an editor can verify.
  await sb.from("business_owners").insert({ business_id: biz.id, user_id: user.id, evidence_note: parsed.data.note ?? null });
  revalidatePath("/business/dashboard");
}

export default async function Dashboard() {
  const u = await requireUser("/business/dashboard");
  const sb = await supabaseServer();
  const { data: claims } = await sb
    .from("business_owners").select("status, requested_at, businesses(name, slug)")
    .eq("user_id", u.userId).order("requested_at", { ascending: false });

  const label = { pending: "Waiting for review", verified: "Verified owner", rejected: "Not approved" } as const;

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-6 py-10">
      <h1 className="text-3xl font-bold">My business</h1>

      <section className="rounded-xl border border-amber-200 bg-white p-5">
        <h2 className="font-semibold">Your listings and claims</h2>
        {!claims || claims.length === 0 ? <p className="mt-2 text-sm text-stone-600">You have not claimed a business yet.</p> : (
          <ul className="mt-3 space-y-2 text-sm">
            {claims.map((c: any, i: number) => (
              <li key={i} className="flex justify-between rounded bg-stone-50 p-3">
                <span>{c.businesses?.name ?? "Listing"}</span>
                <span className={c.status === "verified" ? "font-medium text-green-700" : "text-stone-600"}>{label[c.status as keyof typeof label] ?? c.status}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-stone-500">Once verified, you can update only your own listing. Editing forms arrive with the admin tools.</p>
      </section>

      <section className="rounded-xl border border-amber-200 bg-white p-5">
        <h2 className="font-semibold">Claim a listing</h2>
        <p className="mt-1 text-sm text-stone-700">Enter the listing’s address name (the last part of its page address, e.g. <code>my-shop</code>) and tell us how we can confirm you own it.</p>
        <form action={requestClaim} className="mt-3 space-y-3">
          <input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="my-shop" className="w-full rounded border border-stone-300 px-3 py-2" aria-label="Listing name" />
          <textarea name="note" maxLength={1000} rows={3} placeholder="How can we verify this? (e.g. business email, social page, invoice)" className="w-full rounded border border-stone-300 px-3 py-2" aria-label="Evidence" />
          <button className="rounded bg-orange-700 px-4 py-2 text-white hover:bg-orange-800">Send claim for review</button>
        </form>
      </section>
    </main>
  );
}
