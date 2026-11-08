import { getSystemInfo } from "../lib/api";

export const dynamic = "force-dynamic";

export default async function Home() {
  const info = await getSystemInfo();
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-orange-700">Costa Rica · India</p>
      <h1 className="mt-3 text-5xl font-bold">
        {info.ok ? info.data.siteName : "IndicoRica"}
      </h1>
      <p className="mt-4 text-lg text-stone-700">
        Indian businesses, groceries, relocation guides and community events — in one place.
      </p>

      <section aria-label="System status" className="mt-10 rounded-xl border border-amber-200 bg-white p-5">
        <h2 className="font-semibold">Foundation check</h2>
        {info.ok ? (
          <p className="mt-2 text-sm">
            Site name came from the API (<strong>{info.data.dataSource}</strong> data source
            {info.data.isRealDatabase ? ", real database" : ", NOT a real database"}).
          </p>
        ) : (
          <p role="alert" className="mt-2 text-sm text-red-700">{info.message}</p>
        )}
      </section>
    </main>
  );
}
