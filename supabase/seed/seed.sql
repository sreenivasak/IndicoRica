-- DEMO DATA ONLY. Never run against production.
insert into public.app_settings_public (key, value) values ('site_name', 'IndicoRica')
on conflict (key) do nothing;
