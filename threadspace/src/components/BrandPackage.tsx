import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/format';
import { FEATURES, FeatureKey, LIMITS, Entitlements, peso } from '@/lib/entitlements';
import { Alert, PageLoader, Spinner } from './ui';

interface Pkg { id: string; name: string; price_php: number; features: Partial<Record<FeatureKey, boolean>> }
type Choice = 'follow' | 'on' | 'off';

/** Owner-only: set a brand's package, and force single features on or off for that brand. */
export default function BrandPackage({ storeId }: { storeId: string }) {
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [pkgId, setPkgId] = useState('');
  const [saved, setSaved] = useState('');
  const [choices, setChoices] = useState<Record<FeatureKey, Choice>>({} as Record<FeatureKey, Choice>);
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, s, e, o] = await Promise.all([
      supabase.from('packages').select('id, name, price_php, features').order('sort_order'),
      supabase.from('stores').select('package_id').eq('id', storeId).maybeSingle(),
      supabase.rpc('my_entitlements', { p_store_id: storeId }),
      supabase.from('store_feature_overrides').select('feature, enabled').eq('store_id', storeId),
    ]);
    const err = p.error ?? s.error ?? e.error ?? o.error;
    if (err) setError(errorMessage(err));
    setPkgs((p.data ?? []) as Pkg[]);
    const pid = (s.data as { package_id: string } | null)?.package_id ?? '';
    setPkgId(pid); setSaved(pid);
    setEnt((e.data ?? null) as Entitlements | null);
    const c = {} as Record<FeatureKey, Choice>;
    FEATURES.forEach((f) => { c[f.key] = 'follow'; });
    ((o.data ?? []) as { feature: FeatureKey; enabled: boolean }[]).forEach((x) => { c[x.feature] = x.enabled ? 'on' : 'off'; });
    setChoices(c);
    setLoading(false);
  }, [storeId]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setError(null); setNotice(null); setSaving(true);
    try {
      if (pkgId !== saved) {
        const { error: err } = await supabase.from('stores').update({ package_id: pkgId }).eq('id', storeId);
        if (err) throw err;
      }
      for (const f of FEATURES) {
        const c = choices[f.key];
        if (c === 'follow') {
          const { error: err } = await supabase.from('store_feature_overrides').delete().eq('store_id', storeId).eq('feature', f.key);
          if (err) throw err;
        } else {
          const { error: err } = await supabase.from('store_feature_overrides').upsert({ store_id: storeId, feature: f.key, enabled: c === 'on' }, { onConflict: 'store_id,feature' });
          if (err) throw err;
        }
      }
      setNotice('Saved. The brand’s dashboard and website follow this straight away.');
      await load();
    } catch (e) { setError(errorMessage(e)); }
    setSaving(false);
  }

  if (loading) return <PageLoader />;
  const chosenPkg = pkgs.find((p) => p.id === pkgId);

  return (
    <div className="card space-y-6 p-5">
      {error && <Alert>{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}
      <div className="max-w-sm">
        <label htmlFor="bp-pkg" className="label">Package</label>
        <select id="bp-pkg" className="input" value={pkgId} onChange={(e) => setPkgId(e.target.value)}>
          {pkgs.map((p) => <option key={p.id} value={p.id}>{p.name} · {peso(p.price_php)}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-left text-sm">
          <thead className="border-b border-sand-200 text-sand-500">
            <tr><th className="py-2 pr-4 font-medium">Feature</th><th className="py-2 pr-4 font-medium">In package</th><th className="py-2 pr-4 font-medium">For this brand</th><th className="py-2 font-medium">Result</th></tr>
          </thead>
          <tbody>
            {FEATURES.map((f) => {
              const inPkg = Boolean(chosenPkg?.features?.[f.key]);
              const c = choices[f.key] ?? 'follow';
              const effective = c === 'follow' ? inPkg : c === 'on';
              return (
                <tr key={f.key} className="border-b border-sand-100 last:border-0">
                  <td className="py-2.5 pr-4">{f.label}</td>
                  <td className="py-2.5 pr-4">{inPkg ? 'Yes' : <span className="text-sand-500">No</span>}</td>
                  <td className="py-2.5 pr-4">
                    <select aria-label={`${f.label} for this brand`} className="input w-auto py-1.5" value={c} onChange={(e) => setChoices({ ...choices, [f.key]: e.target.value as Choice })}>
                      <option value="follow">Follow package</option><option value="on">Always on</option><option value="off">Always off</option>
                    </select>
                  </td>
                  <td className="py-2.5"><span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${effective ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-sand-200 bg-sand-100 text-sand-700'}`}>{effective ? 'Enabled' : 'Disabled'}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {ent && (
        <div>
          <p className="label">Usage (current package limits)</p>
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {LIMITS.map((l) => (
              <li key={l.key} className="flex justify-between border-b border-sand-100 py-1.5">
                <span>{l.label}</span>
                <span className="text-sand-500">{l.usage ? ent.usage[l.usage] : '—'} / {ent.limits[l.key] == null ? 'unlimited' : ent.limits[l.key]}</span>
              </li>
            ))}
          </ul>
          <p className="hint">Limits come from the package. Switching a package changes them for this brand only.</p>
        </div>
      )}

      <button type="button" className="btn-primary" disabled={saving} onClick={save}>{saving && <Spinner />} Save package</button>
    </div>
  );
}
