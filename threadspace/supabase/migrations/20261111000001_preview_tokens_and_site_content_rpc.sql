-- Preview keys + the single function connected websites call to read content.
-- (The content tables themselves, homepage_sections, lookbooks, lookbook_photos, videos, media_assets,
--  site_settings and the site-media bucket, came from the earlier migrations cms_content_schema and
--  cms_content_policies_and_storage already applied to the project.)
create table if not exists public.preview_tokens (
  token text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists preview_tokens_store_idx on public.preview_tokens(store_id, created_at desc);
alter table public.preview_tokens enable row level security;
revoke all on public.preview_tokens from anon, authenticated;   -- no direct access; only the functions below

create or replace function public.create_preview_token(p_store_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_token text;
begin
  if not private.can_manage_store(p_store_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  delete from public.preview_tokens where store_id = p_store_id and expires_at < now();
  delete from public.preview_tokens where token in (
    select token from public.preview_tokens where store_id = p_store_id order by created_at desc offset 19);
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.preview_tokens (token, store_id, created_by, expires_at)
  values (v_token, p_store_id, auth.uid(), now() + interval '4 hours');
  return v_token;
end $$;

create or replace function public.get_site_content(p_store_slug text, p_preview_token text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_store public.stores%rowtype;
  v_preview boolean := false;
  v_id uuid;
begin
  select * into v_store from public.stores where slug = p_store_slug and status = 'active';
  if not found then return null; end if;
  v_id := v_store.id;
  if p_preview_token is not null and p_preview_token <> '' then
    v_preview := exists (select 1 from public.preview_tokens t
                          where t.token = p_preview_token and t.store_id = v_id and t.expires_at > now());
  end if;
  return jsonb_build_object(
    'preview', v_preview,
    'store', jsonb_build_object('id', v_store.id, 'name', v_store.name, 'slug', v_store.slug,
      'logo_path', v_store.logo_path, 'banner_path', v_store.banner_path, 'brand_colors', v_store.brand_colors,
      'contact_email', v_store.contact_email, 'contact_phone', v_store.contact_phone,
      'contact_address', v_store.contact_address, 'social_links', v_store.social_links),
    'settings', (select to_jsonb(s) - 'created_at' - 'updated_at' from public.store_settings s where s.store_id = v_id),
    'site', (select jsonb_build_object('website_url', ss.website_url, 'fonts', ss.fonts) from public.site_settings ss where ss.store_id = v_id),
    'sections', coalesce((select jsonb_agg(to_jsonb(h) order by h.sort_order, h.created_at) from public.homepage_sections h
        where h.store_id = v_id and (v_preview or h.status = 'published')), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from public.products p
        where p.store_id = v_id and (v_preview or p.status = 'published')), '[]'::jsonb),
    'images', coalesce((select jsonb_agg(to_jsonb(i) order by i.sort_order) from public.product_images i
        join public.products p on p.id = i.product_id
        where i.store_id = v_id and (v_preview or p.status = 'published')), '[]'::jsonb),
    'variants', coalesce((select jsonb_agg(to_jsonb(v)) from public.product_variants v
        join public.products p on p.id = v.product_id
        where v.store_id = v_id and v.is_active and (v_preview or p.status = 'published')), '[]'::jsonb),
    'lookbooks', coalesce((select jsonb_agg(to_jsonb(l) order by l.sort_order, l.created_at desc) from public.lookbooks l
        where l.store_id = v_id and (v_preview or l.status = 'published')), '[]'::jsonb),
    'lookbook_photos', coalesce((select jsonb_agg(to_jsonb(lp) order by lp.sort_order) from public.lookbook_photos lp
        join public.lookbooks l on l.id = lp.lookbook_id
        where lp.store_id = v_id and (v_preview or l.status = 'published')), '[]'::jsonb),
    'videos', coalesce((select jsonb_agg(to_jsonb(vd) order by vd.sort_order, vd.created_at desc) from public.videos vd
        where vd.store_id = v_id and (v_preview or vd.status = 'published')), '[]'::jsonb)
  );
end $$;

revoke all on function public.create_preview_token(uuid), public.get_site_content(text, text) from public, anon, authenticated;
grant execute on function public.create_preview_token(uuid) to authenticated;
grant execute on function public.get_site_content(text, text) to anon, authenticated;
