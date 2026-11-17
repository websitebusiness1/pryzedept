import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/format';
import { FONTS, ROLES, FontRole, FontsConfig, cssFamily, findFont, googleFontsUrl, weightsFor } from '@/lib/fonts';
import { useSiteSettings } from '@/lib/useSiteSettings';
import { useAuth } from '@/auth/AuthProvider';
import { Alert, PageHeader, PageLoader, Spinner } from '@/components/ui';

type Choice = Record<FontRole, string>;
const EMPTY: Choice = { heading: '', body: '', nav: '', button: '' };

export default function Appearance() {
  const { activeStore } = useAuth();
  const storeId = activeStore?.store_id;
  const readOnly = activeStore?.store.status !== 'active';
  const { settings, loading, reload } = useSiteSettings(storeId);

  const [choice, setChoice] = useState<Choice>(EMPTY);
  const [saved, setSaved] = useState<Choice>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    const next = { ...EMPTY };
    (Object.keys(EMPTY) as FontRole[]).forEach((r) => { const f = settings.fonts?.[r]?.family; if (f && findFont(f)) next[r] = f; });
    setChoice(next); setSaved(next);
  }, [settings]);

  // Load the chosen fonts into this page so the preview is real
  const url = useMemo(() => googleFontsUrl(Object.values(choice).filter(Boolean)), [choice]);
  useEffect(() => {
    if (!url) return;
    let link = document.getElementById('font-preview') as HTMLLinkElement | null;
    if (!link) { link = document.createElement('link'); link.id = 'font-preview'; link.rel = 'stylesheet'; document.head.appendChild(link); }
    link.href = url;
  }, [url]);

  if (loading) return <PageLoader />;
  const dirty = (Object.keys(EMPTY) as FontRole[]).some((r) => choice[r] !== saved[r]);
  const fam = (r: FontRole, fallback: string) => (choice[r] ? cssFamily(choice[r]) : fallback);

  async function save() {
    if (!storeId) return;
    setError(null); setNotice(null); setSaving(true);
    const fonts: FontsConfig = {};
    (Object.keys(choice) as FontRole[]).forEach((r) => { const d = choice[r] ? findFont(choice[r]) : null; if (d) fonts[r] = { family: d.family, weights: weightsFor(d) }; });
    const { error: err } = await supabase.from('site_settings').upsert({ store_id: storeId, fonts }, { onConflict: 'store_id' });
    setSaving(false);
    if (err) { setError(errorMessage(err)); return; }
    setNotice('Fonts saved. Your website now uses them on every page.');
    await reload();
  }

  const groups = ['Display', 'Sans-serif', 'Serif'] as const;

  return (
    <div>
      <PageHeader title="Fonts" description="Choose the typography for your whole website. Changes apply to every page once you save."
        actions={<Link to="/dashboard/preview" className="btn-outline">Preview website</Link>} />
      <div className="mb-6 space-y-3 empty:hidden">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert kind="success">{notice}</Alert>}
        {readOnly && <Alert kind="info">This brand is not active, so fonts can’t be changed right now.</Alert>}
      </div>

      <div className="grid gap-8 lg:grid-cols-[20rem_1fr]">
        <div className="space-y-5">
          {ROLES.map((r) => (
            <div key={r.key}>
              <label htmlFor={`f-${r.key}`} className="label">{r.label}</label>
              <select id={`f-${r.key}`} className="input" value={choice[r.key]} disabled={readOnly || saving} onChange={(e) => setChoice({ ...choice, [r.key]: e.target.value })}>
                <option value="">Website default</option>
                {groups.map((g) => (
                  <optgroup key={g} label={g}>
                    {FONTS.filter((f) => f.group === g).map((f) => <option key={f.family} value={f.family}>{f.family}</option>)}
                  </optgroup>
                ))}
              </select>
              <p className="hint">{r.hint}</p>
            </div>
          ))}
          {!readOnly && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" className="btn-primary" disabled={saving || !dirty} onClick={save}>{saving && <Spinner />} Save fonts</button>
              <button type="button" className="btn-quiet" disabled={saving || !dirty} onClick={() => setChoice(saved)}>Undo changes</button>
              <button type="button" className="btn-quiet" disabled={saving} onClick={() => setChoice(EMPTY)}>Use website defaults</button>
            </div>
          )}
        </div>

        <div className="card overflow-hidden" aria-label="Font preview">
          <p className="border-b border-sand-200 bg-sand-50 px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sand-500">Preview{dirty ? ' (not saved yet)' : ''}</p>
          <div className="space-y-6 bg-white p-6 sm:p-8">
            <nav className="flex flex-wrap gap-x-6 gap-y-2 border-b border-sand-200 pb-4 text-sm" style={{ fontFamily: fam('nav', 'inherit'), fontWeight: 500 }}>
              <span>Shop</span><span>New</span><span>Lookbook</span><span>Videos</span><span>Contact</span>
            </nav>
            <h2 className="text-4xl leading-[1.05] sm:text-6xl" style={{ fontFamily: fam('heading', 'Archivo, sans-serif'), fontWeight: 700 }}>New season, new drop</h2>
            <p className="max-w-lg leading-relaxed" style={{ fontFamily: fam('body', 'inherit'), fontWeight: 400 }}>
              Clothes made for the people wearing them. Every piece is cut, sewn and finished with care, then photographed on the streets where it belongs.
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="bg-black px-6 py-3 text-sm text-white" style={{ fontFamily: fam('button', 'inherit'), fontWeight: 600 }}>Shop now</span>
              <span className="border border-black px-6 py-3 text-sm" style={{ fontFamily: fam('button', 'inherit'), fontWeight: 600 }}>View lookbook</span>
            </div>
          </div>
          <p className="border-t border-sand-200 px-5 py-3 text-xs text-sand-500">Fonts load from Google Fonts. Roles set to “Website default” use whatever your website’s design uses.</p>
        </div>
      </div>
    </div>
  );
}
