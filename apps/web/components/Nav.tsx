import { currentUser } from "../lib/session";

export default async function Nav() {
  let email: string | null = null;
  try { email = (await currentUser())?.email ?? null; } catch { /* sign-in not configured */ }
  return (
    <header className="border-b border-amber-200 bg-white">
      <nav aria-label="Main" className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3 text-sm">
        <a href="/" className="font-bold text-orange-800">IndicoRica</a>
        <div className="flex items-center gap-4">
          {email ? (
            <>
              <a href="/business/dashboard" className="hover:underline">My business</a>
              <a href="/account" className="hover:underline">Account</a>
              <form action="/auth/signout" method="post">
                <button className="rounded border border-stone-300 px-3 py-1 hover:bg-stone-50">Sign out</button>
              </form>
            </>
          ) : (
            <a href="/login" className="rounded bg-orange-700 px-3 py-1 text-white hover:bg-orange-800">Sign in</a>
          )}
        </div>
      </nav>
    </header>
  );
}
