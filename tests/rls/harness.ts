import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..");

export const ids = {
  member: "00000000-0000-0000-0000-000000000001",
  owner: "00000000-0000-0000-0000-000000000002",
  otherOwner: "00000000-0000-0000-0000-000000000003",
  contributor: "00000000-0000-0000-0000-000000000004",
  editor: "00000000-0000-0000-0000-000000000005",
  adManager: "00000000-0000-0000-0000-000000000006",
  superAdmin: "00000000-0000-0000-0000-000000000007",
  contentAdmin: "00000000-0000-0000-0000-000000000008",
};
export const biz = {
  a: "10000000-0000-0000-0000-00000000000a", // owned by `owner`, published
  b: "10000000-0000-0000-0000-00000000000b", // owned by `otherOwner`, published
  draft: "10000000-0000-0000-0000-0000000000dd", // draft, owned by otherOwner
};

export type Actor = keyof typeof ids | "anon" | "postgres";

export function migrationFiles(): string[] {
  const dir = join(root, "supabase", "migrations");
  return readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().map((f) => join(dir, f));
}

export async function freshDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readFileSync(join(import.meta.dirname, "bootstrap.sql"), "utf8"));
  for (const f of migrationFiles()) await db.exec(readFileSync(f, "utf8"));
  return db;
}

export async function seed(db: PGlite) {
  for (const [name, id] of Object.entries(ids)) {
    await db.query("insert into auth.users(id, email) values ($1, $2)", [id, `${name}@example.test`]);
  }
  const role = (u: string, r: string) =>
    db.query("insert into public.user_roles(user_id, role) values ($1, $2)", [u, r]);
  await role(ids.contributor, "contributor");
  await role(ids.editor, "editor");
  await role(ids.adManager, "ad_manager");
  await role(ids.contentAdmin, "content_admin");
  await role(ids.superAdmin, "super_admin");

  await db.exec(`
    insert into public.businesses(id, slug, name, status, is_demo, created_by) values
      ('${biz.a}', 'demo-a', 'Demo A (demo data)', 'published', true, null),
      ('${biz.b}', 'demo-b', 'Demo B (demo data)', 'published', true, null),
      ('${biz.draft}', 'demo-draft', 'Demo Draft (demo data)', 'draft', true, null);
    insert into public.business_owners(business_id, user_id, status) values
      ('${biz.a}', '${ids.owner}', 'verified'),
      ('${biz.b}', '${ids.otherOwner}', 'verified'),
      ('${biz.draft}', '${ids.otherOwner}', 'verified');
    insert into public.business_contacts(business_id, phone, public_consent) values
      ('${biz.a}', '+506 2222 0001', true),
      ('${biz.b}', '+506 2222 0002', false);
    insert into public.articles(id, slug, title, status) values
      ('20000000-0000-0000-0000-000000000001', 'demo-published', 'Demo published', 'published'),
      ('20000000-0000-0000-0000-000000000002', 'demo-draft', 'Demo draft', 'draft');
    insert into public.profile_private(id, phone) values ('${ids.member}', '+506 8888 0000');
  `);
}

export type Result = { ok: boolean; error?: string; code?: string; rows: any[]; affected: number };

/**
 * Run statements as an actor inside one transaction that is ALWAYS rolled back,
 * so tests never affect each other. Each statement gets a savepoint, so one denied
 * statement does not abort the rest. Returns one Result per statement.
 */
export async function as(db: PGlite, actor: Actor, statements: (string | [string, any[]])[]): Promise<Result[]> {
  const out: Result[] = [];
  await db.exec("begin");
  try {
    if (actor === "anon") await db.exec("set local role anon");
    else if (actor !== "postgres") {
      await db.exec("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [ids[actor]]);
    }
    for (const s of statements) {
      const [sql, params] = typeof s === "string" ? [s, []] : s;
      await db.exec("savepoint s");
      try {
        const r = await db.query(sql, params);
        out.push({ ok: true, rows: r.rows, affected: r.affectedRows ?? 0 });
        await db.exec("release savepoint s");
      } catch (e: any) {
        await db.exec("rollback to savepoint s");
        out.push({ ok: false, error: String(e.message), code: e.code, rows: [], affected: 0 });
      }
    }
  } finally {
    await db.exec("rollback");
  }
  return out;
}

export async function one(db: PGlite, actor: Actor, sql: string, params: any[] = []): Promise<Result> {
  return (await as(db, actor, [[sql, params]]))[0];
}

/** A write is "denied" if it errored or touched no rows (RLS filters silently on UPDATE/DELETE). */
export const denied = (r: Result) => !r.ok || r.affected === 0;
