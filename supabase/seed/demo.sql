-- DEMO / STRUCTURAL DATA ONLY. Never run against production content.
-- Categories are structural (not factual claims). No businesses, prices, stock or reviews are invented here.
insert into public.categories (slug, name, kind, position) values
  ('restaurants', 'Restaurants', 'business', 1),
  ('groceries', 'Groceries & ingredients', 'business', 2),
  ('services', 'Services', 'business', 3),
  ('relocation', 'Relocation guides', 'article', 1),
  ('driving', 'Driving', 'article', 2),
  ('banking', 'Banking & money', 'article', 3),
  ('housing', 'Housing', 'article', 4),
  ('dairy', 'Dairy', 'ingredient', 1),
  ('spices', 'Spices', 'ingredient', 2)
on conflict (slug) do nothing;

insert into public.ingredients (slug, name, status) values
  ('milk', 'Milk', 'draft'), ('dahi', 'Dahi (curd)', 'draft'), ('paneer', 'Paneer', 'draft')
on conflict (slug) do nothing;

-- Placeholder only, left as DRAFT: the high-stakes publishing rule means it cannot go live
-- without a completed review and an official source.
insert into public.articles (slug, title, summary, is_high_stakes, status)
select 'driving-license-for-indians', 'Driving license in Costa Rica for Indian citizens (DRAFT)',
       'Draft placeholder. Needs official sources and editorial review before publishing.', true, 'draft'
where not exists (select 1 from public.articles where slug = 'driving-license-for-indians');

insert into public.ad_settings (id, ads_enabled) values (true, true) on conflict do nothing;
