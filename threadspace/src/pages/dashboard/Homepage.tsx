import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/format';
import { publicImageUrl } from '@/lib/storage';
import { publicMediaUrl } from '@/lib/media';
import type { HomepageSection, MediaAsset, SectionType } from '@/lib/types';
import { useAuth } from '@/auth/AuthProvider';
import SortableList, { MoveButtons } from '@/components/SortableList';
import MediaPicker from '@/components/MediaPicker';
import { Alert, ConfirmDialog, EmptyState, PageHeader, PageLoader, Spinner } from '@/components/ui';
import { UsageNote } from '@/components/FeatureGate';
import { FeatureKey, useEntitlements } from '@/lib/entitlements';

const META: Record<SectionType, { label: string; help: string; title: string; config: Record<string, unknown> }> = {
  hero: { label: 'Hero banner', help: 'The big opening banner: image, heading, text and a button.', title: 'New collection', config: {} },
  banner: { label: 'Promo banner', help: 'With an image: a campaign band. Without an image: a scrolling promo text band using the heading.', title: 'Promo', config: {} },
  text: { label: 'Brand intro', help: 'A heading and paragraph, with an optional image and button.', title: 'About us', config: {} },
  products: { label: 'Products', help: 'A product grid: latest, featured, a category, or hand-picked.', title: 'New arrivals', config: { mode: 'latest', limit: 8, product_ids: [] } },
  collections: { label: 'Collections', help: 'Shows your product categories as collection tiles.', title: 'Collections', config: {} },
  lookbook: { label: 'Lookbook', help: 'Your latest published lookbooks.', title: 'Lookbook', config: { limit: 3 } },
  videos: { label: 'Videos', help: 'Your latest published videos.', title: 'Videos', config: { limit: 3 } },
};
const TYPES = Object.keys(META) as SectionType[];
const TYPE_FEATURE: Partial<Record<SectionType, FeatureKey>> = { banner: 'promo_banners', lookbook: 'lookbooks', videos: 'videos' };
const LINK_RE = /^(https?:\/\/\S+|\/\S*)$/;

interface ProductLite { id: string; name: string; category: string; status: string; cover: string | null }

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

function SectionEditor({ section, storeId, products, readOnly, onSave, onCancel }: {
  section: HomepageSection; storeId: string; products: ProductLite[]; readOnly: boolean;
  onSave: (patch: Partial<HomepageSection>) => Promise<string | null>; onCancel: () => void;
}) {
  const t = section.type;
  const [title, setTitle] = useState(section.title ?? '');
  const [body, setBody] = useState(section.body ?? '');
  const { can } = useEntitlements();
  const [videoPath, setVideoPath] = useState(typeof section.config.video_path === 'string' ? (section.config.video_path as string) : '');
  const [pickingVideo, setPickingVideo] = useState(false);
  const [imagePath, setImagePath] = useState(section.image_path);
  const [imageAlt, setImageAlt] = useState(section.image_alt ?? '');
  const [buttonLabel, setButtonLabel] = useState(section.button_label ?? '');
  const [linkUrl, setLinkUrl] = useState(section.link_url ?? '');
  const [mode, setMode] = useState(String(section.config.mode ?? 'latest'));
  const [limit, setLimit] = useState(String(num(section.config.limit, 8)));
  const [category, setCategory] = useState(String(section.config.category ?? ''));
  const [ids, setIds] = useState<string[]>(strs(section.config.product_ids));
  const [search, setSearch] = useState('');
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))).sort(), [products]);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const chosen = ids.map((id) => byId.get(id)).filter((p): p is ProductLite => Boolean(p));
  const results = products.filter((p) => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()));

  async function save() {
    setError(null);
    if (linkUrl.trim() && !LINK_RE.test(linkUrl.trim())) { setError('The link must start with https:// or / (for a page on your website).'); return; }
    if (buttonLabel.trim() && !linkUrl.trim()) { setError('Add a link for the button, or clear the button text.'); return; }
    const patch: Partial<HomepageSection> = { title: title.trim() || null };
    if (t === 'hero' || t === 'banner' || t === 'text') patch.body = body.trim() || null;
    if (t === 'hero') patch.config = { ...section.config, video_path: videoPath || undefined };
    if (t === 'hero' || t === 'banner' || t === 'text') {
      patch.image_path = imagePath; patch.image_alt = imageAlt.trim() || null;
      patch.button_label = buttonLabel.trim() || null; patch.link_url = linkUrl.trim() || null;
    }
    if (t === 'products') {
      const n = Math.round(Number(limit));
      if (!Number.isFinite(n) || n < 1 || n > 24) { setError('Show between 1 and 24 products.'); return; }
      if (mode === 'category' && !category) { setError('Choose a category.'); return; }
      patch.config = { mode, limit: n, category: mode === 'category' ? category : undefined, product_ids: mode === 'selected' ? ids : [] };
    }
    if (t === 'lookbook' || t === 'videos') {
      const n = Math.round(Number(limit));
      if (!Number.isFinite(n) || n < 1 || n > 12) { setError('Show between 1 and 12 items.'); return; }
      patch.config = { limit: n };
    }
    setSaving(true);
    const msg = await onSave(patch);
    setSaving(false);
    if (msg) setError(msg);
  }

  const dis = readOnly || saving;
  const img = publicMediaUrl(imagePath);

  return (
    <div className="space-y-5 border-t border-sand-200 bg-sand-50 p-5">
      {error && <Alert>{error}</Alert>}
      {section.status === 'published' && <Alert kind="info">This section is live. Saving changes updates your website right away. To work privately, hide it first (Hidden), then publish again.</Alert>}

      <div>
        <label htmlFor={`t-${section.id}`} className="label">Heading</label>
        <input id={`t-${section.id}`} className="input" maxLength={200} value={title} disabled={dis} onChange={(e) => setTitle(e.target.value)} />
      </div>

      {(t === 'hero' || t === 'banner' || t === 'text') && (
        <div>
          <label htmlFor={`b-${section.id}`} className="label">{t === 'text' ? 'Text' : 'Description'}</label>
          <textarea id={`b-${section.id}`} rows={4} maxLength={4000} className="input" value={body} disabled={dis} onChange={(e) => setBody(e.target.value)} />
        </div>
      )}

      {(t === 'hero' || t === 'banner' || t === 'text') && (
        <>
          <div>
            <p className="label">Image</p>
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex h-28 w-48 items-center justify-center overflow-hidden border border-sand-200 bg-white">
                {img ? <img src={img} alt={imageAlt || 'Section image'} className="h-full w-full object-cover" /> : <span className="text-xs text-sand-500">No image</span>}
              </div>
              <div className="flex flex-col gap-2">
                <button type="button" className="btn-outline" disabled={dis} onClick={() => setPicking(true)}>{img ? 'Change image' : 'Choose image'}</button>
                {img && <button type="button" className="btn-quiet" disabled={dis} onClick={() => setImagePath(null)}>Remove image</button>}
              </div>
            </div>
          </div>
          {t === 'hero' && (
            <div>
              <p className="label">Background video (optional)</p>
              {can('hero_video') ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-sand-500">{videoPath ? 'A video is set. It plays muted and looping behind the heading.' : 'No video. The image (or your logo) is used.'}</span>
                  <button type="button" className="btn-outline" disabled={dis} onClick={() => setPickingVideo(true)}>{videoPath ? 'Change video' : 'Choose video'}</button>
                  {videoPath && <button type="button" className="btn-quiet" disabled={dis} onClick={() => setVideoPath('')}>Remove video</button>}
                </div>
              ) : <p className="text-sm text-sand-500">Animated hero video isn’t included in your package. Contact Pryze.dept to upgrade.</p>}
            </div>
          )}
          <div>
            <label htmlFor={`a-${section.id}`} className="label">Image description (for accessibility)</label>
            <input id={`a-${section.id}`} className="input" maxLength={300} value={imageAlt} disabled={dis} onChange={(e) => setImageAlt(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`bl-${section.id}`} className="label">Button text (optional)</label>
              <input id={`bl-${section.id}`} className="input" maxLength={60} placeholder="Shop now" value={buttonLabel} disabled={dis} onChange={(e) => setButtonLabel(e.target.value)} />
            </div>
            <div>
              <label htmlFor={`lk-${section.id}`} className="label">Button link</label>
              <input id={`lk-${section.id}`} className="input" placeholder="/shop or https://…" value={linkUrl} disabled={dis} onChange={(e) => setLinkUrl(e.target.value)} />
            </div>
          </div>
        </>
      )}

      {t === 'products' && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor={`m-${section.id}`} className="label">Which products</label>
              <select id={`m-${section.id}`} className="input" value={mode} disabled={dis} onChange={(e) => setMode(e.target.value)}>
                <option value="latest">Latest products</option>
                <option value="featured">Products marked “featured”</option>
                <option value="category">One category</option>
                <option value="selected">Hand-picked</option>
              </select>
            </div>
            <div>
              <label htmlFor={`n-${section.id}`} className="label">How many</label>
              <input id={`n-${section.id}`} type="number" min={1} max={24} className="input" value={limit} disabled={dis} onChange={(e) => setLimit(e.target.value)} />
            </div>
            {mode === 'category' && (
              <div>
                <label htmlFor={`c-${section.id}`} className="label">Category</label>
                <select id={`c-${section.id}`} className="input" value={category} disabled={dis} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Choose…</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
          </div>
          {mode === 'featured' && <p className="hint">Mark products as featured when you edit them in Products.</p>}
          {mode === 'selected' && (
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <p className="label">Chosen ({chosen.length}), in this order</p>
                {chosen.length === 0 ? <p className="text-sm text-sand-500">Pick products from the list.</p> : (
                  <SortableList className="space-y-1" items={chosen} getKey={(p) => p.id} disabled={dis} onReorder={(next) => setIds(next.map((p) => p.id))}
                    render={(p, c) => (
                      <div className={`flex items-center gap-2 border bg-white px-2 py-1.5 text-sm ${c.over ? 'border-black' : 'border-sand-200'}`}>
                        <span className="cursor-grab text-sand-500" aria-hidden>⋮⋮</span>
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        <MoveButtons c={c} label={p.name} />
                        <button type="button" className="px-2 text-red-800" onClick={() => setIds(ids.filter((x) => x !== p.id))} aria-label={`Remove ${p.name}`}>×</button>
                      </div>
                    )} />
                )}
              </div>
              <div>
                <label htmlFor={`s-${section.id}`} className="label">Your products</label>
                <input id={`s-${section.id}`} type="search" className="input mb-2" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
                <ul className="max-h-64 space-y-1 overflow-y-auto">
                  {results.map((p) => {
                    const on = ids.includes(p.id);
                    const thumb = publicImageUrl(p.cover);
                    return (
                      <li key={p.id}>
                        <label className="flex cursor-pointer items-center gap-3 border border-sand-200 bg-white px-2 py-1.5 text-sm">
                          <input type="checkbox" className="h-4 w-4 accent-black" checked={on} disabled={dis} onChange={() => setIds(on ? ids.filter((x) => x !== p.id) : [...ids, p.id])} />
                          <span className="h-10 w-8 shrink-0 overflow-hidden bg-sand-100">{thumb && <img src={thumb} alt="" className="h-full w-full object-cover" />}</span>
                          <span className="min-w-0 flex-1 truncate">{p.name}</span>
                          {p.status === 'draft' && <span className="text-xs text-sand-500">Draft</span>}
                        </label>
                      </li>
                    );
                  })}
                  {results.length === 0 && <li className="text-sm text-sand-500">No products found.</li>}
                </ul>
                <p className="hint">Draft products only show once they are published.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {(t === 'lookbook' || t === 'videos') && (
        <div className="max-w-[10rem]">
          <label htmlFor={`n-${section.id}`} className="label">How many to show</label>
          <input id={`n-${section.id}`} type="number" min={1} max={12} className="input" value={limit} disabled={dis} onChange={(e) => setLimit(e.target.value)} />
        </div>
      )}
      {t === 'collections' && <p className="text-sm text-sand-500">Collections are your product categories. They appear automatically as you add products.</p>}

      <div className="flex gap-2">
        {!readOnly && <button type="button" className="btn-primary" disabled={saving} onClick={save}>{saving && <Spinner />} Save section</button>}
        <button type="button" className="btn-quiet" onClick={onCancel}>Close</button>
      </div>

      {pickingVideo && <MediaPicker storeId={storeId} kind="video" onClose={() => setPickingVideo(false)} onSelect={(a: MediaAsset) => { setVideoPath(a.storage_path); setPickingVideo(false); }} />}
      {picking && <MediaPicker storeId={storeId} kind="image" onClose={() => setPicking(false)} onSelect={(a: MediaAsset) => { setImagePath(a.storage_path); if (!imageAlt && a.alt_text) setImageAlt(a.alt_text); setPicking(false); }} />}
    </div>
  );
}

export default function Homepage() {
  const { activeStore } = useAuth();
  const { can, limit } = useEntitlements();
  const storeId = activeStore?.store_id;
  const readOnly = activeStore?.store.status !== 'active';

  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [newType, setNewType] = useState<SectionType>('hero');
  const [deleting, setDeleting] = useState<HomepageSection | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!storeId) return;
    const [s, p, i] = await Promise.all([
      supabase.from('homepage_sections').select('*').eq('store_id', storeId).order('sort_order').order('created_at'),
      supabase.from('products').select('id, name, category, status').eq('store_id', storeId).order('name'),
      supabase.from('product_images').select('product_id, storage_path, is_cover, sort_order').eq('store_id', storeId),
    ]);
    const err = s.error ?? p.error ?? i.error;
    if (err) setError(errorMessage(err));
    setSections((s.data ?? []) as HomepageSection[]);
    const covers = new Map<string, string>();
    ([...((i.data ?? []) as { product_id: string; storage_path: string; is_cover: boolean; sort_order: number }[])]
      .sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order))
      .forEach((x) => { if (!covers.has(x.product_id)) covers.set(x.product_id, x.storage_path); });
    setProducts(((p.data ?? []) as Omit<ProductLite, 'cover'>[]).map((x) => ({ ...x, cover: covers.get(x.id) ?? null })));
    setLoading(false);
  }, [storeId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  async function add() {
    if (!storeId) return;
    const max = limit('max_homepage_sections');
    if (max != null && sections.length >= max) { setError(`Your package allows up to ${max} homepage sections. Contact Pryze.dept to upgrade.`); return; }
    setError(null); setNotice(null); setBusy(true);
    const m = META[newType];
    const { data, error: err } = await supabase.from('homepage_sections')
      .insert({ store_id: storeId, type: newType, title: m.title, config: m.config, status: 'draft', sort_order: sections.length })
      .select('*').single();
    setBusy(false);
    if (err) { setError(errorMessage(err)); return; }
    setSections([...sections, data as HomepageSection]);
    setOpen((data as HomepageSection).id);
    setNotice('Section added as a draft. Fill it in, save, then publish it.');
  }

  async function saveSection(id: string, patch: Partial<HomepageSection>): Promise<string | null> {
    const { data, error: err } = await supabase.from('homepage_sections').update(patch).eq('id', id).select('*').single();
    if (err) return errorMessage(err);
    setSections((l) => l.map((s) => (s.id === id ? (data as HomepageSection) : s)));
    setNotice('Section saved.');
    return null;
  }

  async function setStatus(s: HomepageSection, status: 'draft' | 'published') {
    setError(null); setNotice(null);
    const { error: err } = await supabase.from('homepage_sections').update({ status }).eq('id', s.id);
    if (err) { setError(errorMessage(err)); return; }
    setSections((l) => l.map((x) => (x.id === s.id ? { ...x, status } : x)));
    setNotice(status === 'published' ? `“${s.title || META[s.type].label}” is now live.` : `“${s.title || META[s.type].label}” is hidden from your website.`);
  }

  async function reorder(next: HomepageSection[]) {
    const withOrder = next.map((s, i) => ({ ...s, sort_order: i }));
    setSections(withOrder);
    const results = await Promise.all(withOrder.map((s) => supabase.from('homepage_sections').update({ sort_order: s.sort_order }).eq('id', s.id)));
    const failed = results.find((r) => r.error);
    if (failed?.error) { setError(`Couldn’t save the new order: ${errorMessage(failed.error)}`); load(); }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    const { error: err } = await supabase.from('homepage_sections').delete().eq('id', deleting.id);
    setBusy(false);
    if (err) { setError(errorMessage(err)); setDeleting(null); return; }
    setSections((l) => l.filter((s) => s.id !== deleting.id));
    setDeleting(null);
    setNotice('Section deleted.');
  }

  async function publishAll() {
    if (!storeId) return;
    setBusy(true); setError(null); setNotice(null);
    const { error: err } = await supabase.from('homepage_sections').update({ status: 'published' }).eq('store_id', storeId).eq('status', 'draft');
    setBusy(false);
    if (err) { setError(errorMessage(err)); return; }
    setSections((l) => l.map((s) => ({ ...s, status: 'published' })));
    setNotice('All sections are now live.');
  }

  if (loading) return <PageLoader />;
  const drafts = sections.filter((s) => s.status === 'draft').length;

  return (
    <div>
      <PageHeader
        title="Homepage"
        description={<>Build your homepage from sections. Drag to reorder, hide what you don’t want shown, and preview before anything goes live. <UsageNote used={sections.length} limit={limit('max_homepage_sections')} noun="sections" /></>}
        actions={<>
          <Link to="/dashboard/preview" className="btn-outline">Preview</Link>
          {!readOnly && drafts > 0 && <button type="button" className="btn-primary" disabled={busy} onClick={publishAll}>Publish {drafts} draft{drafts === 1 ? '' : 's'}</button>}
        </>}
      />
      <div className="mb-6 space-y-3 empty:hidden">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert kind="success">{notice}</Alert>}
        {readOnly && <Alert kind="info">This brand is not active, so the homepage can’t be changed right now.</Alert>}
      </div>

      {!readOnly && (
        <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[14rem] flex-1">
            <label htmlFor="new-type" className="label">Add a section</label>
            <select id="new-type" className="input" value={newType} onChange={(e) => setNewType(e.target.value as SectionType)}>
              {TYPES.map((t) => { const f = TYPE_FEATURE[t]; const ok = !f || can(f); return <option key={t} value={t} disabled={!ok}>{META[t].label}{ok ? '' : ' (not in your package)'}</option>; })}
            </select>
          </div>
          <button type="button" className="btn-primary" disabled={busy} onClick={add}>{busy && <Spinner />} Add section</button>
          <p className="hint w-full">{META[newType].help} New sections start as drafts, hidden from your website.</p>
        </div>
      )}

      {sections.length === 0 ? (
        <EmptyState title="No sections yet">Add a hero banner to start. Until you publish sections, your website shows its default homepage.</EmptyState>
      ) : (
        <SortableList className="space-y-3" items={sections} getKey={(s) => s.id} disabled={readOnly} onReorder={reorder}
          render={(s, c) => (
            <div className={`card ${c.dragging ? 'opacity-50' : ''} ${c.over ? 'border-black' : ''}`}>
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="cursor-grab select-none text-sand-500" aria-hidden title="Drag to reorder">⋮⋮</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{s.title || META[s.type].label}</p>
                  <p className="text-xs text-sand-500">{META[s.type].label}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.status === 'published' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-sand-200 bg-sand-100 text-sand-700'}`}>
                  {s.status === 'published' ? 'Live' : 'Hidden (draft)'}
                </span>
                {!readOnly && <MoveButtons c={c} label={s.title || META[s.type].label} />}
                {!readOnly && (
                  <button type="button" className="btn-outline px-3 py-1.5" onClick={() => setStatus(s, s.status === 'published' ? 'draft' : 'published')}>
                    {s.status === 'published' ? 'Hide' : 'Publish'}
                  </button>
                )}
                <button type="button" className="btn-quiet px-3 py-1.5" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)}>{open === s.id ? 'Close' : 'Edit'}</button>
                {!readOnly && <button type="button" className="px-2 py-1.5 text-sm text-red-800 hover:underline" onClick={() => setDeleting(s)}>Delete</button>}
              </div>
              {open === s.id && storeId && (
                <SectionEditor key={s.updated_at} section={s} storeId={storeId} products={products} readOnly={readOnly}
                  onSave={(patch) => saveSection(s.id, patch)} onCancel={() => setOpen(null)} />
              )}
            </div>
          )} />
      )}

      <ConfirmDialog open={Boolean(deleting)} danger busy={busy} title="Delete this section?"
        message={<>“{deleting?.title || (deleting && META[deleting.type].label)}” will be removed from your homepage. Images you used stay in your media library.</>}
        confirmLabel="Delete section" onConfirm={remove} onCancel={() => setDeleting(null)} />
    </div>
  );
}
