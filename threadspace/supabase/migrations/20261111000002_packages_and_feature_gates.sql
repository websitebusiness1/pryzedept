-- Packages (Starter ₱1,500 / Growth ₱2,500 / Pro ₱3,000), per-brand feature overrides, and the database rules that enforce them.
-- Enforcement is in the database (triggers + get_site_content), so hiding a button is never the only protection.
-- Existing brands are moved to Pro so nothing they have is switched off; new brands default to Starter.

create or replace function private.valid_package_json(f jsonb, l jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(f) = 'object' and jsonb_typeof(l) = 'object'
    and not exists (select 1 from jsonb_each(f) e
        where e.key not in ('lookbooks','videos','promo_banners','custom_fonts','media_library','hero_video')
           or jsonb_typeof(e.value) <> 'boolean')
    and not exists (select 1 from jsonb_each(l) e
        where e.key not in ('max_products','max_photos_per_product','max_lookbooks','max_videos','max_homepage_sections')
           or jsonb_typeof(e.value) not in ('number','null')
           or (jsonb_typeof(e.value) = 'number' and e.value::text !~ '^[0-9]{1,6}$'))
$$;
revoke all on function private.valid_package_json(jsonb, jsonb) from public, anon;
grant execute on function private.valid_package_json(jsonb, jsonb) to authenticated;

create table public.packages (
  id text primary key check (id ~ '^[a-z0-9_]{2,30}$'),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  price_php numeric(10,2) not null check (price_php >= 0),
  sort_order integer not null default 0,
  features jsonb not null default '{}'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint packages_json_ok check (private.valid_package_json(features, limits))
);

insert into public.packages (id, name, price_php, sort_order, features, limits) values
 ('starter','Starter',1500,1,
  '{"lookbooks":false,"videos":false,"promo_banners":false,"custom_fonts":false,"media_library":false,"hero_video":false}',
  '{"max_products":30,"max_photos_per_product":4,"max_lookbooks":null,"max_videos":null,"max_homepage_sections":4}'),
 ('growth','Growth',2500,2,
  '{"lookbooks":true,"videos":true,"promo_banners":true,"custom_fonts":false,"media_library":false,"hero_video":false}',
  '{"max_products":100,"max_photos_per_product":6,"max_lookbooks":6,"max_videos":6,"max_homepage_sections":8}'),
 ('pro','Pro',3000,3,
  '{"lookbooks":true,"videos":true,"promo_banners":true,"custom_fonts":true,"media_library":true,"hero_video":true}',
  '{"max_products":null,"max_photos_per_product":10,"max_lookbooks":null,"max_videos":null,"max_homepage_sections":20}');

alter table public.stores add column package_id text references public.packages(id) on update cascade on delete restrict default 'starter';
update public.stores set package_id = 'pro';
alter table public.stores alter column package_id set not null;

create table public.store_feature_overrides (
  store_id uuid not null references public.stores(id) on delete cascade,
  feature text not null check (feature in ('lookbooks','videos','promo_banners','custom_fonts','media_library','hero_video')),
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  primary key (store_id, feature)
);

alter table public.packages enable row level security;
alter table public.store_feature_overrides enable row level security;
revoke all on public.packages, public.store_feature_overrides from anon;
create policy packages_read on public.packages for select to authenticated using (true);
create policy packages_owner_insert on public.packages for insert to authenticated with check ((select private.is_platform_owner()));
create policy packages_owner_update on public.packages for update to authenticated using ((select private.is_platform_owner())) with check ((select private.is_platform_owner()));
create policy packages_owner_delete on public.packages for delete to authenticated using ((select private.is_platform_owner()));
create policy overrides_read on public.store_feature_overrides for select to authenticated using (private.is_store_member(store_id) or (select private.is_platform_owner()));
create policy overrides_owner_insert on public.store_feature_overrides for insert to authenticated with check ((select private.is_platform_owner()));
create policy overrides_owner_update on public.store_feature_overrides for update to authenticated using ((select private.is_platform_owner())) with check ((select private.is_platform_owner()));
create policy overrides_owner_delete on public.store_feature_overrides for delete to authenticated using ((select private.is_platform_owner()));
create trigger packages_set_updated_at before update on public.packages for each row execute function private.set_updated_at();
create trigger overrides_set_updated_at before update on public.store_feature_overrides for each row execute function private.set_updated_at();

create or replace function private.guard_store_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and not private.is_platform_owner() then
    if new.id is distinct from old.id or new.slug is distinct from old.slug or new.status is distinct from old.status
       or new.package_id is distinct from old.package_id or new.created_at is distinct from old.created_at then
      raise exception 'Only the platform owner can change a brand''s address, status or package' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create or replace function private.feature_on(p_store uuid, p_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select o.enabled from public.store_feature_overrides o where o.store_id = p_store and o.feature = p_key),
    (select (p.features ->> p_key)::boolean from public.stores s join public.packages p on p.id = s.package_id where s.id = p_store),
    false)
$$;
create or replace function private.limit_for(p_store uuid, p_key text)
returns integer language sql stable security definer set search_path = '' as $$
  select (p.limits ->> p_key)::integer from public.stores s join public.packages p on p.id = s.package_id where s.id = p_store
$$;
create or replace function private.is_unrestricted()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is null or private.is_platform_owner()
$$;
revoke all on function private.feature_on(uuid, text), private.limit_for(uuid, text), private.is_unrestricted() from public, anon;
grant execute on function private.feature_on(uuid, text), private.limit_for(uuid, text), private.is_unrestricted() to authenticated;

-- Enforcement triggers: gate_products, gate_product_images, gate_lookbooks, gate_lookbook_photos, gate_videos,
-- gate_homepage_sections (types, section count, hero video), gate_site_fonts. The owner and server-side tasks are never limited.
-- See the project's applied migration "packages_and_feature_gates" for their full bodies.
-- Also applied there: public.my_entitlements(uuid) for the admin, and an updated public.get_site_content()
-- that omits lookbooks / videos / promo banners / hero video / fonts for brands whose package (or override) switches them off.
