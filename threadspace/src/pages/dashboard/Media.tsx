import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/format';
import { IMAGE_ACCEPT, VIDEO_ACCEPT, mediaSize, pathsInUse, publicMediaUrl, removeSiteAsset, replaceSiteImage, uploadSiteImage, uploadSiteVideo, validateVideoFile } from '@/lib/media';
import { validateImage } from '@/lib/storage';
import type { MediaAsset } from '@/lib/types';
import { useAuth } from '@/auth/AuthProvider';
import SortableList, { MoveButtons } from '@/components/SortableList';
import { Alert, ConfirmDialog, EmptyState, PageHeader, PageLoader, Spinner } from '@/components/ui';

function AssetDialog({ asset, inUse, readOnly, categories, onClose, onChanged, onDeleted }: {
  asset: MediaAsset; inUse: boolean; readOnly: boolean; categories: string[];
  onClose: () => void; onChanged: (a: MediaAsset) => void; onDeleted: (a: MediaAsset) => void;
}) {
  const [title, setTitle] = useState(asset.title ?? '');
  const [alt, setAlt] = useState(asset.alt_text ?? '');
  const [category, setCategory] = useState(asset.category ?? 'General');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const url = publicMediaUrl(asset.storage_path) ?? '';

  async function save() {
    setBusy(true); setError(null);
    const { data, error: err } = await supabase.from('media_assets')
      .update({ title: title.trim() || null, alt_text: alt.trim() || null, category: category.trim() || 'General' })
      .eq('id', asset.id).select('*').single();
    setBusy(false);
    if (err) { setError(errorMessage(err)); return; }
    onChanged(data as MediaAsset);
    onClose();
  }

  async function replace(file: File | undefined) {
    if (!file) return;
    const bad = validateImage(file);
    if (bad) { setError(bad); return; }
    setBusy(true); setError(null);
    try { onChanged(await replaceSiteImage(asset, file)); }
    catch (e) { setError(`Replace failed: ${errorMessage(e)}`); }
    setBusy(false);
  }

  async function del() {
    setBusy(true); setError(null);
    try { await removeSiteAsset(asset); onDeleted(asset); onClose(); }
    catch (e) { setError(errorMessage(e)); setConfirm(false); }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Media details" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="grid gap-5 sm:grid-cols-[12rem_1fr]">
          <div>
            <div className="aspect-square overflow-hidden border border-sand-200 bg-sand-50">
              {asset.kind === 'image' ? <img src={url} alt={alt || title || ''} className="h-full w-full object-cover" /> : <video src={url} controls preload="metadata" className="h-full w-full bg-black object-contain" />}
            </div>
            <p className="mt-2 text-xs text-sand-500">{[asset.width && asset.height ? `${asset.width}×${asset.height}` : null, mediaSize(asset.size_bytes)].filter(Boolean).join(' · ')}</p>
            <p className="mt-1 text-xs">{inUse ? <span className="font-semibold">In use on your website</span> : <span className="text-sand-500">Not used anywhere</span>}</p>
          </div>
          <div className="space-y-4">
            {error && <Alert>{error}</Alert>}
            <div><label htmlFor="am-title" className="label">Title</label><input id="am-title" className="input" maxLength={200} value={title} disabled={readOnly || busy} onChange={(e) => setTitle(e.target.value)} /></div>
            {asset.kind === 'image' && <div><label htmlFor="am-alt" className="label">Description (alt text)</label><input id="am-alt" className="input" maxLength={300} value={alt} disabled={readOnly || busy} onChange={(e) => setAlt(e.target.value)} /><p className="hint">Describes the image for screen readers and search.</p></div>}
            <div>
              <label htmlFor="am-cat" className="label">Category</label>
              <input id="am-cat" list="am-cats" className="input" maxLength={60} value={category} disabled={readOnly || busy} onChange={(e) => setCategory(e.target.value)} />
              <datalist id="am-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="flex flex-wrap gap-2">
              {!readOnly && <button type="button" className="btn-primary" disabled={busy} onClick={save}>{busy && <Spinner />} Save</button>}
              {!readOnly && asset.kind === 'image' && (
                <label className={`btn-outline cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}>Replace image
                  <input type="file" className="sr-only" accept={IMAGE_ACCEPT} disabled={busy} onChange={(e) => { replace(e.target.files?.[0]); e.target.value = ''; }} />
                </label>
              )}
              <button type="button" className="btn-quiet" onClick={() => navigator.clipboard?.writeText(url)}>Copy link</button>
              <button type="button" className="btn-quiet" onClick={onClose}>Close</button>
            </div>
            {!readOnly && asset.kind === 'image' && <p className="hint">Replacing keeps the same address, so everything using this image updates automatically (it can take up to an hour to refresh for visitors).</p>}
            {!readOnly && (
              <div className="border-t border-sand-200 pt-4">
                <button type="button" className="btn-danger" disabled={busy || inUse} onClick={() => setConfirm(true)}>Delete</button>
                {inUse && <p className="hint">This file is used on your website. Remove it from the lookbook, video or homepage section first.</p>}
              </div>
            )}
          </div>
        </div>
      </div>
      <ConfirmDialog open={confirm} danger busy={busy} title="Delete this file?" message="It will be permanently removed. This can’t be undone." confirmLabel="Delete file" onConfirm={del} onCancel={() => setConfirm(false)} />
    </div>
  );
}

export default function Media() {
  const { activeStore } = useAuth();
  const storeId = activeStore?.store_id;
  const readOnly = activeStore?.store.status !== 'active';

  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [inUse, setInUse] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [category, setCategory] = useState('all');
  const [kind, setKind] = useState<'all' | 'image' | 'video'>('all');
  const [unusedOnly, setUnusedOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [uploadCategory, setUploadCategory] = useState('General');
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState<MediaAsset | null>(null);
  const [confirmUnused, setConfirmUnused] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!storeId) return;
    const [a, used] = await Promise.all([
      supabase.from('media_assets').select('*').eq('store_id', storeId).order('sort_order').order('created_at', { ascending: false }),
      pathsInUse(storeId).catch(() => new Set<string>()),
    ]);
    if (a.error) setError(errorMessage(a.error));
    setAssets((a.data ?? []) as MediaAsset[]);
    setInUse(used);
    setLoading(false);
  }, [storeId]);
  useEffect(() => { setLoading(true); load(); }, [load]);

  const categories = useMemo(() => Array.from(new Set(assets.map((a) => a.category || 'General'))).sort(), [assets]);
  const filtering = category !== 'all' || kind !== 'all' || unusedOnly || search.trim() !== '';
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) =>
      (category === 'all' || (a.category || 'General') === category) &&
      (kind === 'all' || a.kind === kind) &&
      (!unusedOnly || !inUse.has(a.storage_path)) &&
      (!q || (a.title ?? '').toLowerCase().includes(q) || (a.alt_text ?? '').toLowerCase().includes(q)));
  }, [assets, category, kind, unusedOnly, search, inUse]);
  const unused = assets.filter((a) => !inUse.has(a.storage_path));

  async function upload(files: FileList | null, type: 'image' | 'video') {
    if (!files?.length || !storeId) return;
    setError(null); setNotice(null); setUploading(true);
    const problems: string[] = [];
    let ok = 0;
    for (const file of Array.from(files)) {
      const bad = type === 'image' ? validateImage(file) : validateVideoFile(file);
      if (bad) { problems.push(`${file.name}: ${bad}`); continue; }
      try { if (type === 'image') await uploadSiteImage(storeId, file, uploadCategory.trim() || 'General'); else await uploadSiteVideo(storeId, file, uploadCategory.trim() || 'Videos'); ok++; }
      catch (e) { problems.push(`${file.name}: ${errorMessage(e)}`); }
    }
    setUploading(false);
    if (problems.length) setError(problems.join(' '));
    if (ok) setNotice(`${ok} file${ok === 1 ? '' : 's'} uploaded.`);
    await load();
  }

  async function reorder(next: MediaAsset[]) {
    const ordered = next.map((a, i) => ({ ...a, sort_order: i }));
    const changed = ordered.filter((a, i) => assets[i]?.id !== a.id || assets[i]?.sort_order !== a.sort_order);
    setAssets(ordered);
    const res = await Promise.all(changed.map((a) => supabase.from('media_assets').update({ sort_order: a.sort_order }).eq('id', a.id)));
    const bad = res.find((r) => r.error);
    if (bad?.error) { setError(`Couldn’t save the new order: ${errorMessage(bad.error)}`); load(); }
  }

  async function deleteUnused() {
    setBusy(true); setError(null);
    let removed = 0;
    for (const a of unused) {
      try { await removeSiteAsset(a); removed++; } catch (e) { setError(errorMessage(e)); break; }
    }
    setBusy(false); setConfirmUnused(false);
    setNotice(`${removed} unused file${removed === 1 ? '' : 's'} deleted.`);
    await load();
  }

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader title="Media library" description="Every image and video you’ve uploaded for your website, in one place." />
      <div className="mb-6 space-y-3 empty:hidden">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert kind="success">{notice}</Alert>}
        {readOnly && <Alert kind="info">This brand is not active, so media can’t be changed right now.</Alert>}
      </div>

      {!readOnly && (
        <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[12rem]">
            <label htmlFor="up-cat" className="label">Upload into category</label>
            <input id="up-cat" list="up-cats" className="input" maxLength={60} value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} />
            <datalist id="up-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <label className={`btn-primary cursor-pointer ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
            {uploading && <Spinner />} {uploading ? 'Uploading…' : 'Upload images'}
            <input type="file" multiple className="sr-only" accept={IMAGE_ACCEPT} disabled={uploading} onChange={(e) => { upload(e.target.files, 'image'); e.target.value = ''; }} />
          </label>
          <label className={`btn-outline cursor-pointer ${uploading ? 'pointer-events-none opacity-50' : ''}`}>Upload video
            <input type="file" className="sr-only" accept={VIDEO_ACCEPT} disabled={uploading} onChange={(e) => { upload(e.target.files, 'video'); e.target.value = ''; }} />
          </label>
          <p className="hint w-full">You can pick many images at once. Large photos are resized (longest side 2200 px) and compressed automatically, with no visible loss, so your website loads faster.</p>
        </div>
      )}

      {assets.length === 0 ? (
        <EmptyState title="Your library is empty">Upload images here, or add photos to a lookbook, and they’ll appear in this library.</EmptyState>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input type="search" aria-label="Search media" className="input max-w-xs" placeholder="Search title or description" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select aria-label="Filter by category" className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select aria-label="Filter by type" className="input w-auto" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="all">Images and videos</option><option value="image">Images</option><option value="video">Videos</option>
            </select>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-black" checked={unusedOnly} onChange={(e) => setUnusedOnly(e.target.checked)} /> Unused only</label>
            {!readOnly && unused.length > 0 && <button type="button" className="btn-quiet ml-auto text-red-800" onClick={() => setConfirmUnused(true)}>Delete {unused.length} unused</button>}
          </div>

          {shown.length === 0 ? <EmptyState title="Nothing matches">Try a different search or filter.</EmptyState> : (
            <SortableList className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4" items={shown} getKey={(a) => a.id} disabled={readOnly || filtering} onReorder={reorder}
              render={(a, c) => (
                <div className={`card p-2 ${c.dragging ? 'opacity-50' : ''} ${c.over ? 'border-black' : ''}`}>
                  <button type="button" className="block w-full text-left" onClick={() => setOpen(a)}>
                    <span className="relative block aspect-square overflow-hidden bg-sand-100">
                      {a.kind === 'image' ? <img src={publicMediaUrl(a.storage_path) ?? ''} alt={a.alt_text || a.title || ''} loading="lazy" draggable={false} className="h-full w-full object-cover" />
                        : <span className="flex h-full items-center justify-center text-sm text-sand-500">▶ Video</span>}
                      {!inUse.has(a.storage_path) && <span className="absolute left-1.5 top-1.5 bg-white px-1.5 py-0.5 text-[11px] font-semibold">Unused</span>}
                    </span>
                    <span className="mt-2 block truncate text-sm font-medium">{a.title || 'Untitled'}</span>
                    <span className="block truncate text-xs text-sand-500">{a.category || 'General'}</span>
                  </button>
                  {!readOnly && !filtering && <div className="mt-1 text-right"><MoveButtons c={c} label={a.title || 'file'} /></div>}
                </div>
              )} />
          )}
          <p className="hint mt-3">{filtering ? 'Clear the filters to drag files into a new order.' : 'Drag files (or use the arrows) to reorder them. Click a file to edit its details, replace or delete it.'}</p>
        </>
      )}

      {open && <AssetDialog asset={open} inUse={inUse.has(open.storage_path)} readOnly={readOnly} categories={categories} onClose={() => setOpen(null)}
        onChanged={(a) => { setAssets((l) => l.map((x) => (x.id === a.id ? a : x))); setNotice('Saved.'); }}
        onDeleted={(a) => { setAssets((l) => l.filter((x) => x.id !== a.id)); setNotice('File deleted.'); }} />}
      <ConfirmDialog open={confirmUnused} danger busy={busy} title={`Delete ${unused.length} unused files?`} message="These files aren’t used in any lookbook, video or homepage section. They’ll be permanently deleted." confirmLabel="Delete unused files" onConfirm={deleteUnused} onCancel={() => setConfirmUnused(false)} />
    </div>
  );
}
