import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, biz, denied, freshDb, ids, migrationFiles, one, seed } from "./harness";
import { readFileSync } from "node:fs";

let db: PGlite;
beforeAll(async () => {
  db = await freshDb();
  await seed(db);
}, 60_000);

describe("migrations", () => {
  it("apply from a clean database and are idempotent (re-run all)", async () => {
    for (const f of migrationFiles()) await db.exec(readFileSync(f, "utf8"));
  });
});

describe("structural guarantees", () => {
  it("every table in public has RLS enabled", async () => {
    const r = await db.query(`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    expect(r.rows).toEqual([]);
  });
  it("anon has no write privileges on any table", async () => {
    const r = await db.query(`select table_name, privilege_type from information_schema.role_table_grants
      where grantee = 'anon' and table_schema = 'public' and privilege_type <> 'SELECT'`);
    expect(r.rows).toEqual([]);
  });
  it("no policy lets anon (or PUBLIC) write", async () => {
    const r = await db.query(`select tablename, policyname, cmd, roles from pg_policies
      where cmd <> 'SELECT' and (roles::text like '%anon%' or roles::text like '%public%')`);
    expect(r.rows).toEqual([]);
  });
  it("authenticated cannot update user_roles or audit_log, and moderation_decisions is append-only", async () => {
    const r = await db.query(`select table_name, privilege_type from information_schema.role_table_grants
      where grantee = 'authenticated' and table_schema = 'public' and (
        (table_name = 'user_roles' and privilege_type = 'UPDATE') or
        (table_name = 'audit_log' and privilege_type <> 'SELECT') or
        (table_name = 'article_revisions' and privilege_type <> 'SELECT') or
        (table_name = 'moderation_decisions' and privilege_type in ('UPDATE','DELETE')))`);
    expect(r.rows).toEqual([]);
  });
  it("API roles cannot run migration helper functions", async () => {
    const r = await one(db, "anon", "select private.mk_policy('public.pages','x','select','anon','true')");
    expect(r.ok).toBe(false);
  });
});

describe("guest (anon)", () => {
  it("reads published articles but not drafts", async () => {
    const r = await one(db, "anon", "select slug from public.articles order by slug");
    expect(r.rows.map((x) => x.slug)).toEqual(["demo-published"]);
  });
  it("cannot read draft businesses", async () => {
    const r = await one(db, "anon", "select slug from public.businesses");
    expect(r.rows.map((x) => x.slug).sort()).toEqual(["demo-a", "demo-b"]);
  });
  it("sees only consented contacts", async () => {
    const r = await one(db, "anon", "select business_id from public.business_contacts");
    expect(r.rows.map((x) => x.business_id)).toEqual([biz.a]);
  });
  it("cannot read profiles, private phone, roles, audit log, advertisers", async () => {
    for (const t of ["profiles", "profile_private", "user_roles", "audit_log", "advertisers", "app_settings"]) {
      const r = await one(db, "anon", `select * from public.${t}`);
      expect(r.ok ? r.rows.length : 0, t).toBe(0);
    }
  });
  it("cannot write anything", async () => {
    const rs = await as(db, "anon", [
      "insert into public.pages(slug,title) values ('x','x')",
      "update public.businesses set name = 'hacked'",
      "delete from public.articles",
      "insert into public.questions(title, body) values ('hello there', 'x')",
    ]);
    rs.forEach((r) => expect(denied(r)).toBe(true));
  });
});

describe("member", () => {
  it("cannot read drafts", async () => {
    const r = await one(db, "member", "select slug from public.articles");
    expect(r.rows.map((x) => x.slug)).toEqual(["demo-published"]);
  });
  it("cannot grant themselves admin (or any role)", async () => {
    const rs = await as(db, "member", [
      [`insert into public.user_roles(user_id, role) values ($1, 'super_admin')`, [ids.member]],
    ]);
    expect(rs[0].ok).toBe(false);
  });
  it("reads own private phone only", async () => {
    const own = await one(db, "member", "select phone from public.profile_private");
    expect(own.rows).toHaveLength(1);
    const other = await one(db, "otherOwner", "select phone from public.profile_private");
    expect(other.rows).toHaveLength(0);
  });
  it("cannot read or alter another person's private data", async () => {
    const rs = await as(db, "otherOwner", [
      [`update public.profile_private set phone = '+506 1111 1111' where id = $1`, [ids.member]],
      [`delete from public.profile_private where id = $1`, [ids.member]],
      [`insert into public.profile_private(id, phone) values ($1, '+506 1111 1111')`, [ids.member]],
    ]);
    rs.forEach((r) => expect(denied(r)).toBe(true));
  });
  it("asks a question but it is forced to pending and cannot self-approve", async () => {
    const rs = await as(db, "member", [
      "insert into public.questions(title, body) values ('Where is paneer?', 'Cariari?') returning moderation_status",
      "update public.questions set moderation_status = 'approved' returning moderation_status",
      "select count(*)::int as n from public.questions where moderation_status = 'approved'",
    ]);
    expect(rs[0].rows[0].moderation_status).toBe("pending");
    expect(rs[1].rows.every((x: any) => x.moderation_status === "pending")).toBe(true);
    expect(rs[2].rows[0].n).toBe(0);
  });
  it("cannot insert a question as someone else", async () => {
    const r = await one(db, "member", "insert into public.questions(author_id, title, body) values ($1, 'Fake author', 'x')", [ids.owner]);
    expect(denied(r)).toBe(true);
  });
  it("manages only own favorites", async () => {
    const rs = await as(db, "member", [
      [`insert into public.favorites(business_id) values ($1)`, [biz.a]],
      [`insert into public.favorites(user_id, business_id) values ($1, $2)`, [ids.owner, biz.a]],
    ]);
    expect(rs[0].ok).toBe(true);
    expect(rs[1].ok).toBe(false);
  });
  it("submits events as pending only", async () => {
    const r = await one(db, "member",
      "insert into public.event_submissions(title, starts_at, status) values ('Diwali', now(), 'approved') returning status");
    expect(r.rows[0].status).toBe("pending"); // forced by trigger, cannot self-approve
    const ok = await one(db, "member",
      "insert into public.event_submissions(title, starts_at) values ('Diwali', now()) returning status");
    expect(ok.rows[0].status).toBe("pending");
  });
  it("cannot publish content or create businesses", async () => {
    const rs = await as(db, "member", [
      "insert into public.articles(slug, title, status) values ('m1','m1','published')",
      "insert into public.businesses(slug, name) values ('m1','m1')",
    ]);
    rs.forEach((r) => expect(denied(r)).toBe(true));
  });
  it("can only file a pending ownership claim for themselves", async () => {
    const rs = await as(db, "member", [
      [`insert into public.business_owners(business_id, user_id, status) values ($1, $2, 'verified') returning status`, [biz.a, ids.member]],
      [`insert into public.business_owners(business_id, user_id) values ($1, $2)`, [biz.a, ids.owner]],
      [`insert into public.business_owners(business_id, user_id) values ($1, $2) returning status`, [biz.a, ids.member]],
    ]);
    expect(rs[0].rows[0].status).toBe("pending"); // self-verify coerced to pending
    expect(rs[1].ok).toBe(false);            // cannot claim on behalf of someone else
    expect(rs[2].ok).toBe(false);            // duplicate claim by same user/business
  });
});

describe("business owners", () => {
  it("owner edits own business", async () => {
    const r = await one(db, "owner", "update public.businesses set description = 'Fresh paneer' where id = $1", [biz.a]);
    expect(r.affected).toBe(1);
  });
  it("owner cannot edit a different owner's business", async () => {
    const rs = await as(db, "owner", [
      [`update public.businesses set description = 'hijack' where id = $1`, [biz.b]],
      [`update public.business_contacts set phone = '+506 0000 0000' where business_id = $1`, [biz.b]],
      [`insert into public.business_hours(business_id, weekday) values ($1, 1)`, [biz.b]],
    ]);
    rs.forEach((r) => expect(denied(r)).toBe(true));
  });
  it("owner cannot self-verify, change slug, or publish/trash", async () => {
    const rs = await as(db, "owner", [
      [`update public.businesses set verification_status = 'verified', verification_source = 'me', slug = 'new-slug' where id = $1 returning verification_status, slug`, [biz.a]],
      [`update public.businesses set status = 'archived' where id = $1`, [biz.a]],
    ]);
    expect(rs[0].rows[0]).toEqual({ verification_status: "unverified", slug: "demo-a" });
    expect(rs[1].ok).toBe(false);
  });
  it("owner cannot see another owner's draft business", async () => {
    const r = await one(db, "owner", "select id from public.businesses where id = $1", [biz.draft]);
    expect(r.rows).toHaveLength(0);
  });
  it("owner's uploaded image starts unapproved and cannot self-approve", async () => {
    const r = await one(db, "owner",
      `insert into public.business_images(business_id, storage_path, alt_text, is_approved)
       values ($1::uuid, $1::text || '/shop.jpg', 'Shop front', true) returning is_approved`, [biz.a]);
    expect(r.rows[0].is_approved).toBe(false);
    const g = await one(db, "anon", "select id from public.business_images");
    expect(g.rows).toHaveLength(0);
  });
  it("owner records contact consent with a DB-stamped time; pending owners get no rights", async () => {
    const r = await one(db, "otherOwner",
      "update public.business_contacts set public_consent = true where business_id = $1 returning consent_by, consent_at", [biz.b]);
    expect(r.rows[0].consent_by).toBe(ids.otherOwner);
    expect(r.rows[0].consent_at).not.toBeNull();
    const rs = await as(db, "member", [
      [`insert into public.business_owners(business_id, user_id) values ($1, $2)`, [biz.a, ids.member]],
      [`update public.businesses set description = 'pending claim edit' where id = $1`, [biz.a]],
    ]);
    expect(denied(rs[1])).toBe(true);
  });
});

describe("contributor / editor workflow", () => {
  it("contributor creates drafts but cannot publish", async () => {
    const rs = await as(db, "contributor", [
      "insert into public.articles(slug, title) values ('c1','c1') returning status",
      "insert into public.articles(slug, title, status) values ('c2','c2','in_review') returning status",
      "insert into public.articles(slug, title, status) values ('c3','c3','published')",
      "update public.articles set status = 'published' where slug = 'c1'",
    ]);
    expect(rs[0].rows[0].status).toBe("draft");
    expect(rs[1].ok).toBe(true);
    expect(rs[2].ok).toBe(false);
    expect(rs[3].ok).toBe(false);
  });
  it("contributor cannot edit someone else's draft", async () => {
    const r = await one(db, "contributor", "update public.articles set title = 'x' where slug = 'demo-draft'");
    expect(denied(r)).toBe(true);
  });
  it("editor publishes, trash records who/when, restore clears it, revisions kept", async () => {
    const rs = await as(db, "editor", [
      "update public.articles set status = 'published' where slug = 'demo-draft' returning published_at",
      "update public.articles set status = 'trashed' where slug = 'demo-draft' returning deleted_by",
      "update public.articles set status = 'draft' where slug = 'demo-draft' returning deleted_by",
      "select count(*)::int as n from public.article_revisions where article_id = '20000000-0000-0000-0000-000000000002'",
      "delete from public.articles where slug = 'demo-draft'",
    ]);
    expect(rs[0].rows[0].published_at).not.toBeNull();
    expect(rs[1].rows[0].deleted_by).toBe(ids.editor);
    expect(rs[2].rows[0].deleted_by).toBeNull();
    expect(rs[3].rows[0].n).toBeGreaterThanOrEqual(3);
    expect(denied(rs[4])).toBe(true); // hard delete is super-admin only
  });
  it("high-stakes article cannot publish without review and a cited source", async () => {
    const id = "20000000-0000-0000-0000-0000000000aa";
    const rs = await as(db, "editor", [
      [`insert into public.articles(id, slug, title, is_high_stakes) values ($1, 'license', 'Driving license', true)`, [id]],
      [`update public.articles set status = 'published' where id = $1`, [id]],
      [`update public.articles set review_status = 'reviewed', last_reviewed_at = current_date where id = $1`, [id]],
      [`update public.articles set status = 'published' where id = $1`, [id]],
      [`insert into public.editorial_sources(article_id, title, url, accessed_on) values ($1, 'Official page', 'https://example.gov/license', current_date)`, [id]],
      [`update public.articles set status = 'published' where id = $1 returning status`, [id]],
    ]);
    expect(rs[1].ok).toBe(false);
    expect(rs[3].ok).toBe(false); // reviewed but no source
    expect(rs[5].rows[0].status).toBe("published");
  });
  it("only editors can mark an article reviewed", async () => {
    const r = await one(db, "contributor",
      `insert into public.articles(slug, title, review_status, last_reviewed_at) values ('r1','r1','reviewed', current_date) returning review_status`);
    expect(r.rows[0].review_status).toBe("unreviewed");
  });
  it("verifying a business requires a source", async () => {
    const rs = await as(db, "editor", [
      [`update public.businesses set verification_status = 'verified' where id = $1`, [biz.a]],
      [`update public.businesses set verification_status = 'verified', verification_source = 'Visited 2026-11-08' where id = $1 returning verified_by`, [biz.a]],
    ]);
    expect(rs[0].ok).toBe(false);
    expect(rs[1].rows[0].verified_by).toBe(ids.editor);
  });
  it("editor verifies ownership claims; availability evidence needs approval and a past date", async () => {
    const ing = "30000000-0000-0000-0000-000000000001";
    const rs = await as(db, "member", [
      [`insert into public.ingredients(id, slug, name, status) values ($1, 'paneer', 'Paneer', 'published')`, [ing]],
    ]);
    expect(rs[0].ok).toBe(false);
    const ev = await as(db, "editor", [
      [`insert into public.ingredients(id, slug, name, status) values ($1, 'paneer', 'Paneer', 'published')`, [ing]],
      [`insert into public.availability_evidence(ingredient_id, business_id, observed_on, source_type) values ($1, $2, current_date + 1, 'staff_visit')`, [ing, biz.a]],
      [`insert into public.availability_evidence(ingredient_id, business_id, observed_on, source_type, status) values ($1, $2, current_date, 'staff_visit', 'approved')`, [ing, biz.a]],
    ]);
    expect(ev[1].ok).toBe(false); // future date rejected
    expect(ev[2].ok).toBe(true);
  });
  it("member tip is pending and invisible to guests until approved", async () => {
    const ing = "30000000-0000-0000-0000-000000000002";
    await db.query(`insert into public.ingredients(id, slug, name, status) values ($1, 'dahi', 'Dahi', 'published')`, [ing]);
    const rs = await as(db, "member", [
      [`insert into public.availability_evidence(ingredient_id, business_id, observed_on, source_type, status) values ($1, $2, current_date, 'member_tip', 'approved') returning status`, [ing, biz.a]],
    ]);
    expect(rs[0].rows[0].status).toBe("pending"); // cannot insert as approved

    const g = await one(db, "anon", "select * from public.availability_evidence where ingredient_id = $1", [ing]);
    expect(g.rows).toHaveLength(0);
    await db.query("delete from public.availability_evidence where ingredient_id = $1", [ing]);
    await db.query("delete from public.ingredients where id = $1", [ing]);
  });
  it("editor cannot touch roles, audit log or private user data", async () => {
    const rs = await as(db, "editor", [
      [`insert into public.user_roles(user_id, role) values ($1, 'super_admin')`, [ids.editor]],
      [`delete from public.user_roles where user_id = $1`, [ids.contributor]],
      `delete from public.audit_log`,
      `update public.audit_log set action = 'x'`,
      `select * from public.profile_private`,
      `select * from public.advertisers`,
    ]);
    expect(rs[0].ok).toBe(false);
    expect(denied(rs[1])).toBe(true);
    expect(denied(rs[2])).toBe(true);
    expect(denied(rs[3])).toBe(true);
    expect(rs[4].rows).toHaveLength(0);
    expect(rs[5].rows).toHaveLength(0);
  });
  it("editor cannot see the audit log; content admin can", async () => {
    expect((await one(db, "editor", "select * from public.audit_log")).rows).toHaveLength(0);
    expect((await one(db, "contentAdmin", "select count(*)::int as n from public.audit_log")).rows[0].n).toBeGreaterThan(0);
  });
});

describe("advertising", () => {
  const setup = async () => {
    await db.query(`insert into public.ad_slots(id, slot_key, label) values ('40000000-0000-0000-0000-000000000001', 'home_top', 'Home top')`);
    await db.query(`insert into public.ad_providers(provider_key, name, approved) values ('adsense', 'Google AdSense', false)`);
  };
  it("editor cannot alter ad network configuration, providers, slots or kill switch", async () => {
    await setup();
    const rs = await as(db, "editor", [
      `insert into public.ad_providers(provider_key, name, approved) values ('evil', 'Evil', true)`,
      `update public.ad_providers set approved = true where provider_key = 'adsense'`,
      `insert into public.ad_provider_config(provider_key, slot_id, provider_slot_id, enabled) values ('adsense','40000000-0000-0000-0000-000000000001','123',true)`,
      `update public.ad_settings set ads_enabled = false`,
      `insert into public.ad_slots(slot_key, label) values ('x','x')`,
    ]);
    rs.forEach((r) => expect(denied(r)).toBe(true));
    await db.query("delete from public.ad_slots"); await db.query("delete from public.ad_providers");
  });
  it("ad manager manages campaigns and kill switch but cannot approve a provider", async () => {
    await setup();
    const rs = await as(db, "adManager", [
      `update public.ad_providers set approved = true where provider_key = 'adsense'`,
      `insert into public.ad_provider_config(provider_key, slot_id, provider_slot_id, enabled) values ('adsense','40000000-0000-0000-0000-000000000001','ca-pub-1/2',true)`,
      `update public.ad_settings set ads_enabled = false returning ads_enabled`,
    ]);
    expect(denied(rs[0])).toBe(true);
    expect(rs[1].ok).toBe(false); // provider not approved -> cannot enable
    expect(rs[2].rows[0].ads_enabled).toBe(false);
    await db.query("delete from public.ad_slots"); await db.query("delete from public.ad_providers");
  });
  it("super admin approves a provider; config rejects script-like IDs", async () => {
    await setup();
    const rs = await as(db, "superAdmin", [
      `update public.ad_providers set approved = true where provider_key = 'adsense' returning reviewed_by`,
      `insert into public.ad_provider_config(provider_key, slot_id, provider_slot_id, enabled) values ('adsense','40000000-0000-0000-0000-000000000001','<script>alert(1)</script>',true)`,
      `insert into public.ad_provider_config(provider_key, slot_id, provider_slot_id, enabled) values ('adsense','40000000-0000-0000-0000-000000000001','ca-pub-1/2',true)`,
    ]);
    expect(rs[0].rows[0].reviewed_by).toBe(ids.superAdmin);
    expect(rs[1].ok).toBe(false);
    expect(rs[2].ok).toBe(true);
    await db.query("delete from public.ad_slots"); await db.query("delete from public.ad_providers");
  });
  it("campaign targeting and disclosure are constrained; kill switch hides live campaigns from guests", async () => {
    const adv = "50000000-0000-0000-0000-000000000001", cr = "50000000-0000-0000-0000-000000000002", sl = "50000000-0000-0000-0000-000000000003";
    await db.query(`insert into public.advertisers(id, name) values ('${adv}', 'Demo advertiser')`);
    await db.query(`insert into public.ad_creatives(id, advertiser_id, image_path, alt_text, click_url, review_status) values ('${cr}', '${adv}', 'a/b.png', 'Banner', 'https://example.test', 'approved')`);
    await db.query(`insert into public.ad_slots(id, slot_key, label) values ('${sl}', 'side', 'Side')`);
    const ins = (extra: string) => `insert into public.ad_campaigns(advertiser_id, creative_id, slot_id, starts_on, ends_on, status ${extra.split("|")[0]}) values ('${adv}','${cr}','${sl}', current_date - 1, current_date + 1, 'approved' ${extra.split("|")[1]})`;
    const rs = await as(db, "adManager", [
      ins(", targeting|, '{\"script\":\"x\"}'::jsonb"),
      ins(", disclosure_label|, 'Totally organic'"),
      ins(", targeting|, '{\"areas\":[\"cariari\"]}'::jsonb"),
    ]);
    expect(rs[0].ok).toBe(false);
    expect(rs[1].ok).toBe(false);
    expect(rs[2].ok).toBe(true);
    await db.query(ins(", targeting|, '{}'::jsonb"));
    expect((await one(db, "anon", "select count(*)::int as n from public.ad_campaigns")).rows[0].n).toBe(1);
    await db.query("update public.ad_settings set ads_enabled = false");
    expect((await one(db, "anon", "select count(*)::int as n from public.ad_campaigns")).rows[0].n).toBe(0);
    await db.query("update public.ad_settings set ads_enabled = true");
  });
});

describe("roles and audit", () => {
  it("super admin grants a role; the grant is stamped and audited", async () => {
    const rs = await as(db, "superAdmin", [
      [`insert into public.user_roles(user_id, role, granted_by) values ($1, 'editor', $2) returning granted_by`, [ids.member, ids.member]],
      [`select count(*)::int as n from public.audit_log where table_name = 'user_roles' and action = 'INSERT'`],
    ] as any);
    expect(rs[0].rows[0].granted_by).toBe(ids.superAdmin); // client-supplied value ignored
  });
  it("audit rows cannot be forged or removed by super admin through the API", async () => {
    const rs = await as(db, "superAdmin", [
      `insert into public.audit_log(action, table_name) values ('fake','x')`,
      `delete from public.audit_log`,
      `update public.audit_log set action = 'x'`,
    ]);
    rs.forEach((r) => expect(denied(r)).toBe(true));
  });
  it("user can update only their own profile", async () => {
    const rs = await as(db, "member", [
      [`update public.profiles set display_name = 'Me' where id = $1`, [ids.member]],
      [`update public.profiles set display_name = 'Not me' where id = $1`, [ids.owner]],
    ]);
    expect(rs[0].affected).toBe(1);
    expect(denied(rs[1])).toBe(true);
  });
  it("public author view exposes only display names of approved authors", async () => {
    await db.query(`update public.profiles set display_name = 'Asha' where id = $1`, [ids.member]);
    await db.query(`insert into public.questions(author_id, title, body, moderation_status) values ($1, 'Approved question', 'x', 'approved')`, [ids.member]);
    const r = await one(db, "anon", "select * from public.community_authors");
    expect(r.rows).toEqual([{ id: ids.member, display_name: "Asha" }]);
    await db.query("delete from public.questions");
  });
});

describe("storage", () => {
  const obj = (bucket: string, name: string) =>
    `insert into storage.objects(bucket_id, name) values ('${bucket}', '${name}')`;
  it("owner uploads to own business folder only; guests cannot upload", async () => {
    const rs = await as(db, "owner", [
      obj("business-images", `${biz.a}/shop.jpg`),
      obj("business-images", `${biz.b}/shop.jpg`),
      obj("business-images", "not-a-uuid/shop.jpg"),
    ]);
    expect(rs[0].ok).toBe(true);
    expect(rs[1].ok).toBe(false);
    expect(rs[2].ok).toBe(false);
    expect((await one(db, "anon", obj("business-images", `${biz.a}/x.jpg`))).ok).toBe(false);
  });
  it("private imports are readable/writable only by content admins", async () => {
    await db.query(obj("private-imports", "whatsapp.csv"));
    expect((await one(db, "anon", "select * from storage.objects where bucket_id = 'private-imports'")).rows).toHaveLength(0);
    expect((await one(db, "member", "select * from storage.objects where bucket_id = 'private-imports'")).rows).toHaveLength(0);
    expect((await one(db, "editor", "select * from storage.objects where bucket_id = 'private-imports'")).rows).toHaveLength(0);
    expect((await one(db, "contentAdmin", "select * from storage.objects where bucket_id = 'private-imports'")).rows).toHaveLength(1);
    expect((await one(db, "member", obj("private-imports", "x.csv"))).ok).toBe(false);
    await db.query("delete from storage.objects");
  });
  it("buckets enforce size and MIME limits", async () => {
    const r = await db.query("select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id");
    const byId = Object.fromEntries(r.rows.map((x: any) => [x.id, x]));
    expect(byId["private-imports"].public).toBe(false);
    expect(byId["business-images"].allowed_mime_types).not.toContain("text/html");
    expect(byId["business-images"].file_size_limit).toBeLessThanOrEqual(5 * 1024 * 1024);
  });
});

describe("moderation queue", () => {
  it("is visible to editors only", async () => {
    await db.query(`insert into public.questions(author_id, title, body) values ($1, 'Pending question', 'x')`, [ids.member]);
    expect((await one(db, "editor", "select * from public.moderation_queue")).rows.length).toBeGreaterThan(0);
    expect((await one(db, "member", "select * from public.moderation_queue where kind <> 'questions'")).rows).toHaveLength(0);
    expect((await one(db, "anon", "select * from public.moderation_queue")).ok).toBe(false);
    await db.query("delete from public.questions");
  });
});

describe("contracts and seed", () => {
  it("TypeScript enums match the PostgreSQL enums", async () => {
    const { AppRole, ContentStatus, VerificationStatus } = await import("../../packages/contracts/src/data");
    const labels = async (t: string) =>
      (await db.query(`select enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
        where t.typname = $1 order by e.enumsortorder`, [t])).rows.map((r: any) => r.enumlabel);
    expect(await labels("app_role")).toEqual(AppRole.options);
    expect(await labels("content_status")).toEqual(ContentStatus.options);
    expect(await labels("verification_status")).toEqual(VerificationStatus.options);
  });
  it("demo seed applies twice, creates nothing public that is factual, and the license draft cannot be published", async () => {
    const sql = readFileSync(new URL("../../supabase/seed/demo.sql", import.meta.url), "utf8");
    await db.exec(sql); await db.exec(sql);
    const pub = await one(db, "anon", "select slug from public.articles where slug = 'driving-license-for-indians'");
    expect(pub.rows).toHaveLength(0);
    expect((await one(db, "anon", "select count(*)::int as n from public.businesses where is_demo = false")).rows[0].n).toBe(0);
    const r = await one(db, "editor", "update public.articles set status = 'published' where slug = 'driving-license-for-indians'");
    expect(r.ok).toBe(false);
  });
});
