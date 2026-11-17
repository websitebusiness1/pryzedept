import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/format';
import { IMAGE_ACCEPT, publicMediaUrl, uploadSiteImage } from '@/lib/media';
import { validateImage } from '@/lib/storage';
import type { ContentStatus, Lookbook, LookbookPhoto } from '@/lib/types';
import { useAuth } from '@/auth/AuthProvider';
import SortableList, { MoveButtons } from '@/components/SortableList';
import { Alert, ConfirmDialog, EmptyState, PageHeader, PageLoader, Spinner } from '@/components/ui';

export default function LookbookEditor({ mode }: { mode: 'new' | 'edit' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeStore } = useAuth();
  const storeId = activeStore?.store_id;
  const readOnly = activeStore?.store.status !== 'active';
  const flash = (useLocation().state as { notice?: string } | null)?.notice;

  const [lookbook, setLookbook] = useState<Lookbook | null>(null);
  const [photos, setPhotos] = useState<LookbookPhoto[]>([]);
  const [loading, setLoading] = useState(mode === 'edit');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [collection, setCollection] = useState('');
  const [shootDate, setShootDate] = useState('');
  const [status, setStatus] = useState<ContentStatus>('draft');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(flash ?? null);
  const [removing, setRemoving] = useState<LookbookPhoto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (mode !== 'edit' || !storeId) return;
    const [l, p] = await Promise.all([
      supabase.from('lookbooks').select('*').eq('id', id ?? '').eq('store_id', storeId).maybeSingle(),
      supabase.from('lookbook_photos').select('*').eq('lookbook_id', id ?? '').eq('store_id', storeId).order('sort_order').order('created_at'),
    ]);
    const err = l.error ?? p.error;
    if (err) setError(errorMessage(err));
    const row = (l.data ?? null) as Lookbook | null;
    setLookbook(row);
    setPhotos((p.data ?? []) as LookbookPhoto[]);
    if (row) { setTitle(row.title); setDescription(row.description); setCollection(row.collection_name ?? ''); setShootDate(row.shoot_date ?? ''); setStatus(row.status); }
    setLoading(false);
  }, [mode, id, storeId]);
  useEffect(() => { load(); }, [load]);

  if (!storeId) return null;
  if (loading) return <PageLoader />;
  if (mode === 'edit' && !lookbook) {
    return <EmptyState title="Lookbook not found" action={<Link to="/dashboard/lookbooks" className="btn-outline">Back to lookbooks</Link>}>It may have been deleted.</EmptyState>;
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (readOnly || !storeId) return;
    setError(null); setNotice(null);
    if (!title.trim()) { setError('Give the lookbook a title.'); return; }
    if (status === 'published' && photos.length === 0) { setError('Add at least one photo before publishing, or keep it as a draft.'); return; }
    const fields = { title: title.trim(), description: description.trim(), collection_name: collection.trim() || null, shoot_date: shootDate || null, status };
    setSaving(true);
    if (mode === 'new') {
      const { data, error: err } = await supabase.from('lookbooks').insert({ ...fields, status: 'draft', store_id: storeId }).select('id').single();
      setSaving(false);
      if (err) { setError(errorMessage(err)); return; }
      navigate(`/dashboard/lookbooks/${data.id}`, { replace: true, state: { notice: 'Lookbook created as a draft. Now add the photos.' } });
      return;
    }
    const { error: err } = await supabase.from('lookbooks').update(fields).eq('id', lookbook!.id);
    setSaving(false);
    if (err) { setError(errorMessage(err)); return; }
    setNotice(status === 'published' ? 'Saved. This lookbook is live on your website.' : 'Saved as a draft.');
    load();
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length || !lookbook || !storeId) return;
    setError(null); setNotice(null); setUploading(true);
    const problems: string[] = [];
    let next = photos.reduce((m, p) => Math.max(m, p.sort_order), -1) + 1;
    let first = photos.length === 0;
    for (const file of Array.from(files)) {
      const bad = validateImage(file);
      if (bad) { problems.push(`${file.name}: ${bad}`); continue; }
      try {
        const asset = await uploadSiteImage(storeId, file, 'Lookbooks');
        const { error: err } = await supabase.from('lookbook_photos').insert({
          lookbook_id: lookbook.id, store_id: storeId, storage_path: asset.storage_path, alt_text: lookbook.title, sort_order: next++, is_cover: first,
        });
        if (err) throw err;
        first = false;
      } catch (e) { problems.push(`${file.name}: ${errorMessage(e)}`); }
    }
    setUploading(false);
    if (problems.length) setError(problems.join(' '));
    await load();
  }

  async function reorder(next: LookbookPhoto[]) {
    const ordered = next.map((p, i) => ({ ...p, sort_order: i }));
    setPhotos(ordered);
    const res = await Promise.all(ordered.map((p) => supabase.from('lookbook_photos').update({ sort_order: p.sort_order }).eq('id', p.id)));
    const bad = res.find((r) => r.error);
    if (bad?.error) { setError(`Couldn’t save the new order: ${errorMessage(bad.error)}`); load(); }
  }

  async function setCover(p: LookbookPhoto) {
    setError(null);
    const a = await supabase.from('lookbook_photos').update({ is_cover: false }).eq('lookbook_id', p.lookbook_id).eq('is_cover', true).neq('id', p.id);
    const b = await supabase.from('lookbook_photos').update({ is_cover: true }).eq('id', p.id);
    if (a.error || b.error) setError(errorMessage(a.error ?? b.error));
    await load();
  }

  async function saveText(p: LookbookPhoto, patch: Partial<Pick<LookbookPhoto, 'alt_text' | 'caption'>>) {
    const { error: err } = await supabase.from('lookbook_photos').update(patch).eq('id', p.id);
    if (err) setError(errorMessage(err));
  }

  async function removePhoto() {
    if (!removing) return;
    setBusy(true);
    const { error: err } = await supabase.from('lookbook_photos').delete().eq('id', removing.id);
    if (!err && removing.is_cover) {
      const nextCover = photos.find((x) => x.id !== removing.id);
      if (nextCover) await supabase.from('lookbook_photos').update({ is_cover: true }).eq('id', nextCover.id);
    }
    setBusy(false); setRemoving(null);
    if (err) { setError(errorMessage(err)); return; }
    setNotice('Photo removed. The file stays in your media library until you delete it there.');
    await load();
  }

  async function deleteLookbook() {
    if (!lookbook) return;
    setDeleting(true);
    const { error: err } = await supabase.from('lookbooks').delete().eq('id', lookbook.id);
    if (err) { setDeleting(false); setError(errorMessage(err)); return; }
    navigate('/dashboard/lookbooks', { replace: true, state: { notice: `“${lookbook.title}” was deleted.` } });
  }

  const dis = readOnly || saving;

  return (
    <div>
      <Link to="/dashboard/lookbooks" className="text-sm text-sand-500 hover:text-black">← All lookbooks</Link>
      <div className="mt-3"><PageHeader title={mode === 'new' ? 'New lookbook' : lookbook!.title} description={mode === 'new' ? 'Start with the title and story. You’ll add photos on the next screen.' : `Link name: ${lookbook!.slug}`} /></div>
      <div className="mb-6 space-y-3 empty:hidden">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert kind="success">{notice}</Alert>}
        {readOnly && <Alert kind="info">This brand is not active, so lookbooks can’t be changed right now.</Alert>}
      </div>

      <form onSubmit={save} className="card mb-10 grid gap-5 p-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="lb-title" className="label">Title</label>
          <input id="lb-title" required maxLength={160} className="input" value={title} disabled={dis} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="lb-desc" className="label">Description</label>
          <textarea id="lb-desc" rows={4} maxLength={4000} className="input" value={description} disabled={dis} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label htmlFor="lb-col" className="label">Collection name (optional)</label>
          <input id="lb-col" maxLength={120} className="input" placeholder="Summer 2026" value={collection} disabled={dis} onChange={(e) => setCollection(e.target.value)} />
        </div>
        <div>
          <label htmlFor="lb-date" className="label">Photoshoot date (optional)</label>
          <input id="lb-date" type="date" className="input" value={shootDate} disabled={dis} onChange={(e) => setShootDate(e.target.value)} />
        </div>
        {mode === 'edit' && (
          <fieldset className="md:col-span-2" disabled={dis}>
            <legend className="label">Visibility</legend>
            <div className="flex flex-wrap gap-6 text-sm">
              {(['draft', 'published'] as ContentStatus[]).map((v) => (
                <label key={v} className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="lb-status" className="accent-black" checked={status === v} onChange={() => setStatus(v)} />
                  {v === 'draft' ? 'Draft (hidden from your website)' : 'Published (live on your website)'}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {!readOnly && <div className="md:col-span-2"><button type="submit" className="btn-primary" disabled={saving}>{saving && <Spinner />} {mode === 'new' ? 'Create lookbook' : 'Save changes'}</button></div>}
      </form>

      {mode === 'edit' && lookbook && (
        <>
          <section aria-labelledby="lb-photos" className="mb-10">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <h2 id="lb-photos" className="font-display text-2xl">Photos ({photos.length})</h2>
              {!readOnly && (
                <label className={`btn-primary cursor-pointer ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
                  {uploading && <Spinner />} {uploading ? 'Uploading…' : 'Add photos'}
                  <input type="file" multiple className="sr-only" accept={IMAGE_ACCEPT} disabled={uploading} onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
                </label>
              )}
            </div>
            {photos.length === 0 ? (
              <EmptyState title="No photos yet">Add several photos at once. Big files are resized and compressed automatically.</EmptyState>
            ) : (
              <>
                <SortableList className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4" items={photos} getKey={(p) => p.id} disabled={readOnly} onReorder={reorder}
                  render={(p, c) => (
                    <div className={`card p-2 ${c.dragging ? 'opacity-50' : ''} ${c.over ? 'border-black' : ''}`}>
                      <div className="relative aspect-[3/4] overflow-hidden bg-sand-100">
                        <img src={publicMediaUrl(p.storage_path) ?? ''} alt={p.alt_text || ''} loading="lazy" className="h-full w-full object-cover" draggable={false} />
                        {p.is_cover && <span className="absolute left-1.5 top-1.5 bg-black px-2 py-0.5 text-[11px] font-semibold text-white">Cover</span>}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        {p.is_cover ? <span className="font-semibold">Cover photo</span> : <button type="button" className="underline underline-offset-2 disabled:no-underline" disabled={readOnly} onClick={() => setCover(p)}>Set as cover</button>}
                        {!readOnly && <MoveButtons c={c} label={`photo ${c.index + 1}`} />}
                      </div>
                      <input aria-label={`Description for photo ${c.index + 1}`} className="input mt-2 px-2 py-1.5 text-xs" placeholder="Description (alt text)" maxLength={300} defaultValue={p.alt_text ?? ''} disabled={readOnly}
                        onBlur={(e) => { if (e.target.value !== (p.alt_text ?? '')) saveText(p, { alt_text: e.target.value.trim() || null }); }} />
                      <input aria-label={`Caption for photo ${c.index + 1}`} className="input mt-1.5 px-2 py-1.5 text-xs" placeholder="Caption (optional)" maxLength={300} defaultValue={p.caption ?? ''} disabled={readOnly}
                        onBlur={(e) => { if (e.target.value !== (p.caption ?? '')) saveText(p, { caption: e.target.value.trim() || null }); }} />
                      {!readOnly && <button type="button" className="mt-2 text-xs text-red-800 underline underline-offset-2" onClick={() => setRemoving(p)}>Remove</button>}
                    </div>
                  )} />
                <p className="hint mt-3">Drag photos (or use the arrows) to set their order. Descriptions help people using screen readers and improve search.</p>
              </>
            )}
          </section>

          {!readOnly && (
            <div className="border-t border-sand-200 pt-6">
              <button type="button" className="btn-danger" onClick={() => setDeleting(true)}>Delete lookbook</button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog open={Boolean(removing)} danger busy={busy} title="Remove this photo?" message="It’s removed from this lookbook. The file stays in your media library." confirmLabel="Remove photo" onConfirm={removePhoto} onCancel={() => setRemoving(null)} />
      <ConfirmDialog open={deleting} danger busy={busy} title="Delete this lookbook?" message={<>“{lookbook?.title}” and its photo list will be permanently deleted. The image files stay in your media library. To just hide it, set it to Draft instead.</>} confirmLabel="Delete lookbook" onConfirm={deleteLookbook} onCancel={() => setDeleting(false)} />
    </div>
  );
}
