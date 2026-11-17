import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/format';
import { publicMediaUrl } from '@/lib/media';
import { parseVideoUrl } from '@/lib/video';
import type { Video } from '@/lib/types';
import { useAuth } from '@/auth/AuthProvider';
import SortableList, { MoveButtons } from '@/components/SortableList';
import { Alert, EmptyState, PageHeader, PageLoader } from '@/components/ui';
import { UsageNote } from '@/components/FeatureGate';
import { useEntitlements } from '@/lib/entitlements';

export const sourceLabel = (v: Video) => {
  if (v.source_type === 'upload') return 'Uploaded file';
  const p = v.video_url ? parseVideoUrl(v.video_url) : null;
  return p?.kind === 'youtube' ? 'YouTube' : p?.kind === 'vimeo' ? 'Vimeo' : 'Video link';
};

export const thumbFor = (v: Video): string | null => {
  if (v.thumbnail_path) return publicMediaUrl(v.thumbnail_path);
  const p = v.source_type === 'url' && v.video_url ? parseVideoUrl(v.video_url) : null;
  return p?.kind === 'youtube' ? p.thumbUrl : null;
};

export default function Videos() {
  const { activeStore } = useAuth();
  const storeId = activeStore?.store_id;
  const readOnly = activeStore?.store.status !== 'active';
  const flash = (useLocation().state as { notice?: string } | null)?.notice;
  const { limit } = useEntitlements();

  const [items, setItems] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!storeId) return;
    const { data, error: err } = await supabase.from('videos').select('*').eq('store_id', storeId).order('sort_order').order('created_at', { ascending: false });
    if (err) setError(errorMessage(err));
    setItems((data ?? []) as Video[]);
    setLoading(false);
  }, [storeId]);
  useEffect(() => { setLoading(true); load(); }, [load]);

  async function reorder(next: Video[]) {
    const ordered = next.map((v, i) => ({ ...v, sort_order: i }));
    setItems(ordered);
    const res = await Promise.all(ordered.map((v) => supabase.from('videos').update({ sort_order: v.sort_order }).eq('id', v.id)));
    const bad = res.find((r) => r.error);
    if (bad?.error) { setError(`Couldn’t save the new order: ${errorMessage(bad.error)}`); load(); }
  }

  async function toggle(v: Video) {
    setError(null);
    const status = v.status === 'published' ? 'draft' : 'published';
    const { error: err } = await supabase.from('videos').update({ status }).eq('id', v.id);
    if (err) { setError(errorMessage(err)); return; }
    setItems((l) => l.map((x) => (x.id === v.id ? { ...x, status } : x)));
  }

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader title="Videos" description={<>Campaign films, behind-the-scenes and reels for your website. <UsageNote used={items.length} limit={limit('max_videos')} noun="videos" /></>}
        actions={!readOnly ? (limit('max_videos') != null && items.length >= (limit('max_videos') as number)
          ? <span className="self-center text-sm text-sand-500">Video limit reached. Contact Pryze.dept to upgrade.</span>
          : <Link to="/dashboard/videos/new" className="btn-primary">Add video</Link>) : undefined} />
      <div className="mb-6 space-y-3 empty:hidden">
        {flash && <Alert kind="success">{flash}</Alert>}
        {error && <Alert>{error}</Alert>}
      </div>
      {items.length === 0 ? (
        <EmptyState title="No videos yet" action={!readOnly ? <Link to="/dashboard/videos/new" className="btn-primary">Add your first video</Link> : undefined}>
          Upload a video file or paste a YouTube or Vimeo link.
        </EmptyState>
      ) : (
        <>
          <SortableList className="space-y-3" items={items} getKey={(v) => v.id} disabled={readOnly} onReorder={reorder}
            render={(v, c) => {
              const thumb = thumbFor(v);
              return (
                <div className={`card flex flex-wrap items-center gap-4 p-3 ${c.dragging ? 'opacity-50' : ''} ${c.over ? 'border-black' : ''}`}>
                  <span className="cursor-grab select-none px-1 text-sand-500" aria-hidden title="Drag to reorder">⋮⋮</span>
                  <Link to={`/dashboard/videos/${v.id}`} className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden bg-sand-100 text-xs text-sand-500">
                    {thumb ? <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" /> : 'No thumbnail'}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link to={`/dashboard/videos/${v.id}`} className="block truncate font-semibold hover:underline">{v.title}</Link>
                    <p className="text-xs text-sand-500">{sourceLabel(v)}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${v.status === 'published' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-sand-200 bg-sand-100 text-sand-700'}`}>{v.status === 'published' ? 'Published' : 'Draft'}</span>
                  {!readOnly && <MoveButtons c={c} label={v.title} />}
                  {!readOnly && <button type="button" className="btn-outline px-3 py-1.5" onClick={() => toggle(v)}>{v.status === 'published' ? 'Unpublish' : 'Publish'}</button>}
                  <Link to={`/dashboard/videos/${v.id}`} className="btn-quiet px-3 py-1.5">Edit</Link>
                </div>
              );
            }} />
          <p className="hint mt-3">Drag a video (or use the arrows) to change the order on your website.</p>
        </>
      )}
    </div>
  );
}
