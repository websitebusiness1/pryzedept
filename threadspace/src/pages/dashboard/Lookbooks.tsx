import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { errorMessage, formatDate } from '@/lib/format';
import { publicMediaUrl } from '@/lib/media';
import type { Lookbook } from '@/lib/types';
import { useAuth } from '@/auth/AuthProvider';
import SortableList, { MoveButtons } from '@/components/SortableList';
import { Alert, EmptyState, PageHeader, PageLoader } from '@/components/ui';
import { UsageNote } from '@/components/FeatureGate';
import { useEntitlements } from '@/lib/entitlements';

interface PhotoRow { lookbook_id: string; storage_path: string; is_cover: boolean; sort_order: number }

export default function Lookbooks() {
  const { activeStore } = useAuth();
  const storeId = activeStore?.store_id;
  const readOnly = activeStore?.store.status !== 'active';
  const flash = (useLocation().state as { notice?: string } | null)?.notice;
  const { limit } = useEntitlements();

  const [items, setItems] = useState<Lookbook[]>([]);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!storeId) return;
    const [l, p] = await Promise.all([
      supabase.from('lookbooks').select('*').eq('store_id', storeId).order('sort_order').order('created_at', { ascending: false }),
      supabase.from('lookbook_photos').select('lookbook_id, storage_path, is_cover, sort_order').eq('store_id', storeId),
    ]);
    const err = l.error ?? p.error;
    if (err) setError(errorMessage(err));
    setItems((l.data ?? []) as Lookbook[]);
    setPhotos((p.data ?? []) as PhotoRow[]);
    setLoading(false);
  }, [storeId]);
  useEffect(() => { setLoading(true); load(); }, [load]);

  const coverOf = (id: string) => {
    const mine = photos.filter((p) => p.lookbook_id === id).sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order);
    return { path: mine[0]?.storage_path ?? null, count: mine.length };
  };

  async function reorder(next: Lookbook[]) {
    const ordered = next.map((l, i) => ({ ...l, sort_order: i }));
    setItems(ordered);
    const res = await Promise.all(ordered.map((l) => supabase.from('lookbooks').update({ sort_order: l.sort_order }).eq('id', l.id)));
    const bad = res.find((r) => r.error);
    if (bad?.error) { setError(`Couldn’t save the new order: ${errorMessage(bad.error)}`); load(); }
  }

  async function toggle(l: Lookbook) {
    setError(null);
    const status = l.status === 'published' ? 'draft' : 'published';
    if (status === 'published' && coverOf(l.id).count === 0) { setError('Add at least one photo before publishing this lookbook.'); return; }
    const { error: err } = await supabase.from('lookbooks').update({ status }).eq('id', l.id);
    if (err) { setError(errorMessage(err)); return; }
    setItems((list) => list.map((x) => (x.id === l.id ? { ...x, status } : x)));
  }

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Lookbooks"
        description={<>Your photoshoots. Each lookbook becomes a gallery on your website. <UsageNote used={items.length} limit={limit('max_lookbooks')} noun="lookbooks" /></>}
        actions={!readOnly ? (limit('max_lookbooks') != null && items.length >= (limit('max_lookbooks') as number)
          ? <span className="self-center text-sm text-sand-500">Lookbook limit reached. Contact Pryze.dept to upgrade.</span>
          : <Link to="/dashboard/lookbooks/new" className="btn-primary">New lookbook</Link>) : undefined}
      />
      <div className="mb-6 space-y-3 empty:hidden">
        {flash && <Alert kind="success">{flash}</Alert>}
        {error && <Alert>{error}</Alert>}
      </div>
      {items.length === 0 ? (
        <EmptyState title="No lookbooks yet" action={!readOnly ? <Link to="/dashboard/lookbooks/new" className="btn-primary">Create your first lookbook</Link> : undefined}>
          Upload the photos from a shoot, add a title and story, then publish when it’s ready.
        </EmptyState>
      ) : (
        <>
          <SortableList className="space-y-3" items={items} getKey={(l) => l.id} disabled={readOnly} onReorder={reorder}
            render={(l, c) => {
              const cover = coverOf(l.id);
              const img = publicMediaUrl(cover.path);
              return (
                <div className={`card flex flex-wrap items-center gap-4 p-3 ${c.dragging ? 'opacity-50' : ''} ${c.over ? 'border-black' : ''}`}>
                  <span className="cursor-grab select-none px-1 text-sand-500" aria-hidden title="Drag to reorder">⋮⋮</span>
                  <Link to={`/dashboard/lookbooks/${l.id}`} className="h-20 w-16 shrink-0 overflow-hidden bg-sand-100">
                    {img && <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" />}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link to={`/dashboard/lookbooks/${l.id}`} className="block truncate font-semibold hover:underline">{l.title}</Link>
                    <p className="text-xs text-sand-500">
                      {[l.collection_name, l.shoot_date ? formatDate(l.shoot_date) : null, `${cover.count} photo${cover.count === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${l.status === 'published' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-sand-200 bg-sand-100 text-sand-700'}`}>{l.status === 'published' ? 'Published' : 'Draft'}</span>
                  {!readOnly && <MoveButtons c={c} label={l.title} />}
                  {!readOnly && <button type="button" className="btn-outline px-3 py-1.5" onClick={() => toggle(l)}>{l.status === 'published' ? 'Unpublish' : 'Publish'}</button>}
                  <Link to={`/dashboard/lookbooks/${l.id}`} className="btn-quiet px-3 py-1.5">Edit</Link>
                </div>
              );
            }} />
          <p className="hint mt-3">Drag a lookbook (or use the arrows) to change the order it appears in on your website.</p>
        </>
      )}
    </div>
  );
}
