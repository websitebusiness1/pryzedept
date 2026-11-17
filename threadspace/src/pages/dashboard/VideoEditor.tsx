import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/format';
import { VIDEO_ACCEPT, publicMediaUrl, uploadSiteVideo, validateVideoFile } from '@/lib/media';
import { parseVideoUrl } from '@/lib/video';
import type { ContentStatus, MediaAsset, Video } from '@/lib/types';
import { useAuth } from '@/auth/AuthProvider';
import MediaPicker from '@/components/MediaPicker';
import { Alert, ConfirmDialog, EmptyState, PageHeader, PageLoader, Spinner } from '@/components/ui';

export default function VideoEditor({ mode }: { mode: 'new' | 'edit' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeStore } = useAuth();
  const storeId = activeStore?.store_id;
  const readOnly = activeStore?.store.status !== 'active';

  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(mode === 'edit');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState<'upload' | 'url'>('url');
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbPath, setThumbPath] = useState<string | null>(null);
  const [status, setStatus] = useState<ContentStatus>('draft');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'edit' || !storeId) return;
    let cancelled = false;
    supabase.from('videos').select('*').eq('id', id ?? '').eq('store_id', storeId).maybeSingle().then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) setError(errorMessage(err));
      const v = (data ?? null) as Video | null;
      setVideo(v);
      if (v) { setTitle(v.title); setDescription(v.description); setSource(v.source_type); setVideoPath(v.video_path); setVideoUrl(v.video_url ?? ''); setThumbPath(v.thumbnail_path); setStatus(v.status); }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [mode, id, storeId]);

  if (!storeId) return null;
  if (loading) return <PageLoader />;
  if (mode === 'edit' && !video) return <EmptyState title="Video not found" action={<Link to="/dashboard/videos" className="btn-outline">Back to videos</Link>}>It may have been deleted.</EmptyState>;

  const parsed = source === 'url' && videoUrl.trim() ? parseVideoUrl(videoUrl) : null;
  const dis = readOnly || saving;

  async function onFile(file: File | undefined) {
    if (!file || !storeId) return;
    setError(null);
    const bad = validateVideoFile(file);
    if (bad) { setError(bad); return; }
    setUploading(true);
    try { const a = await uploadSiteVideo(storeId, file, 'Videos'); setVideoPath(a.storage_path); if (!title.trim()) setTitle(a.title ?? ''); }
    catch (e) { setError(`Upload failed: ${errorMessage(e)}`); }
    setUploading(false);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (readOnly || !storeId) return;
    setError(null); setNotice(null);
    if (!title.trim()) { setError('Give the video a title.'); return; }
    if (source === 'upload' && !videoPath) { setError('Upload a video file, or switch to a link.'); return; }
    if (source === 'url' && !parsed) { setError('Paste an https link to a YouTube or Vimeo video, or a direct .mp4 / .webm / .mov file.'); return; }
    const fields = {
      title: title.trim(), description: description.trim(), source_type: source, status, thumbnail_path: thumbPath,
      video_path: source === 'upload' ? videoPath : null, video_url: source === 'url' ? videoUrl.trim() : null,
    };
    setSaving(true);
    if (mode === 'new') {
      const { count } = await supabase.from('videos').select('id', { count: 'exact', head: true }).eq('store_id', storeId);
      const { data, error: err } = await supabase.from('videos').insert({ ...fields, store_id: storeId, sort_order: count ?? 0 }).select('id').single();
      setSaving(false);
      if (err) { setError(errorMessage(err)); return; }
      navigate('/dashboard/videos', { replace: true, state: { notice: `“${fields.title}” was added${status === 'published' ? ' and is live' : ' as a draft'}.` } });
      void data;
      return;
    }
    const { error: err } = await supabase.from('videos').update(fields).eq('id', video!.id);
    setSaving(false);
    if (err) { setError(errorMessage(err)); return; }
    setNotice(status === 'published' ? 'Saved. This video is live on your website.' : 'Saved as a draft.');
  }

  async function remove() {
    if (!video) return;
    setSaving(true);
    const { error: err } = await supabase.from('videos').delete().eq('id', video.id);
    if (err) { setSaving(false); setConfirmDelete(false); setError(errorMessage(err)); return; }
    navigate('/dashboard/videos', { replace: true, state: { notice: `“${video.title}” was deleted.` } });
  }

  const thumbUrl = publicMediaUrl(thumbPath);
  const fileUrl = publicMediaUrl(videoPath);

  return (
    <div>
      <Link to="/dashboard/videos" className="text-sm text-sand-500 hover:text-black">← All videos</Link>
      <div className="mt-3"><PageHeader title={mode === 'new' ? 'Add video' : video!.title} /></div>
      <div className="mb-6 space-y-3 empty:hidden">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert kind="success">{notice}</Alert>}
        {readOnly && <Alert kind="info">This brand is not active, so videos can’t be changed right now.</Alert>}
      </div>

      <form onSubmit={save} className="space-y-8">
        <div className="card grid gap-5 p-5">
          <div>
            <label htmlFor="v-title" className="label">Title</label>
            <input id="v-title" required maxLength={160} className="input" value={title} disabled={dis} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label htmlFor="v-desc" className="label">Description</label>
            <textarea id="v-desc" rows={3} maxLength={4000} className="input" value={description} disabled={dis} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <div className="card space-y-5 p-5">
          <fieldset disabled={dis}>
            <legend className="label">Video source</legend>
            <div className="flex flex-wrap gap-6 text-sm">
              <label className="flex cursor-pointer items-center gap-2"><input type="radio" name="src" className="accent-black" checked={source === 'url'} onChange={() => setSource('url')} /> Link (YouTube, Vimeo or .mp4)</label>
              <label className="flex cursor-pointer items-center gap-2"><input type="radio" name="src" className="accent-black" checked={source === 'upload'} onChange={() => setSource('upload')} /> Upload a file</label>
            </div>
          </fieldset>

          {source === 'url' ? (
            <div>
              <label htmlFor="v-url" className="label">Video link</label>
              <input id="v-url" type="url" className="input" placeholder="https://www.youtube.com/watch?v=…" value={videoUrl} disabled={dis} onChange={(e) => setVideoUrl(e.target.value)} />
              {videoUrl.trim() && !parsed && <p className="mt-1 text-xs text-red-800">That link isn’t supported. Use https and a YouTube, Vimeo or direct .mp4/.webm/.mov link.</p>}
              {parsed && (
                <div className="mt-4 max-w-xl">
                  {parsed.kind === 'file'
                    ? <video src={parsed.fileUrl} controls preload="metadata" className="aspect-video w-full bg-black" />
                    : <iframe title="Video preview" src={parsed.embedUrl} className="aspect-video w-full border-0 bg-black" allow="fullscreen; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" />}
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="label">Video file</p>
              {fileUrl && <video src={fileUrl} controls preload="metadata" className="mb-3 aspect-video w-full max-w-xl bg-black" />}
              <label className={`btn-outline cursor-pointer ${uploading || dis ? 'pointer-events-none opacity-50' : ''}`}>
                {uploading && <Spinner />} {uploading ? 'Uploading… this can take a while' : fileUrl ? 'Replace video' : 'Choose video'}
                <input type="file" className="sr-only" accept={VIDEO_ACCEPT} disabled={uploading || dis} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              <p className="hint">MP4, WebM or MOV, up to 50 MB. For longer or larger videos, upload to YouTube or Vimeo and use a link.</p>
            </div>
          )}
        </div>

        <div className="card p-5">
          <p className="label">Thumbnail</p>
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex aspect-video w-56 items-center justify-center overflow-hidden border border-sand-200 bg-sand-50">
              {thumbUrl ? <img src={thumbUrl} alt="Video thumbnail" className="h-full w-full object-cover" /> : <span className="px-3 text-center text-xs text-sand-500">No thumbnail chosen</span>}
            </div>
            <div className="flex flex-col gap-2">
              <button type="button" className="btn-outline" disabled={dis} onClick={() => setPicking(true)}>{thumbUrl ? 'Change thumbnail' : 'Choose or upload thumbnail'}</button>
              {thumbUrl && <button type="button" className="btn-quiet" disabled={dis} onClick={() => setThumbPath(null)}>Remove thumbnail</button>}
            </div>
          </div>
          <p className="hint">If you don’t choose one, YouTube videos use their own thumbnail and other videos show their first frame.</p>
        </div>

        <fieldset className="card p-5" disabled={dis}>
          <legend className="label px-1">Visibility</legend>
          <div className="flex flex-wrap gap-6 text-sm">
            {(['draft', 'published'] as ContentStatus[]).map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2"><input type="radio" name="v-status" className="accent-black" checked={status === v} onChange={() => setStatus(v)} />{v === 'draft' ? 'Draft (hidden from your website)' : 'Published (live on your website)'}</label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-4">
          {!readOnly && <button type="submit" className="btn-primary" disabled={saving || uploading}>{saving && <Spinner />} {mode === 'new' ? 'Add video' : 'Save changes'}</button>}
          {mode === 'edit' && !readOnly && <button type="button" className="btn-danger" onClick={() => setConfirmDelete(true)}>Delete video</button>}
        </div>
      </form>

      {picking && <MediaPicker storeId={storeId} kind="image" onClose={() => setPicking(false)} onSelect={(a: MediaAsset) => { setThumbPath(a.storage_path); setPicking(false); }} />}
      <ConfirmDialog open={confirmDelete} danger busy={saving} title="Delete this video?" message={<>“{video?.title}” will be permanently deleted from your website. Uploaded files stay in your media library. To just hide it, set it to Draft.</>} confirmLabel="Delete video" onConfirm={remove} onCancel={() => setConfirmDelete(false)} />
    </div>
  );
}
