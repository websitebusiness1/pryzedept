import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from '@/auth/AuthProvider';

export type FeatureKey = 'lookbooks' | 'videos' | 'promo_banners' | 'custom_fonts' | 'media_library' | 'hero_video';
export type LimitKey = 'max_products' | 'max_photos_per_product' | 'max_lookbooks' | 'max_videos' | 'max_homepage_sections';

export const FEATURES: { key: FeatureKey; label: string; help: string }[] = [
  { key: 'lookbooks', label: 'Lookbooks', help: 'Photoshoot galleries' },
  { key: 'videos', label: 'Videos', help: 'Upload videos or link YouTube/Vimeo' },
  { key: 'promo_banners', label: 'Promo banners', help: 'Campaign banners and the scrolling promo band' },
  { key: 'custom_fonts', label: 'Custom fonts', help: 'Choose the website’s fonts' },
  { key: 'media_library', label: 'Media library', help: 'Organise, replace and clean up all uploads' },
  { key: 'hero_video', label: 'Animated hero video', help: 'A looping video in the homepage hero' },
];
export const LIMITS: { key: LimitKey; label: string; usage?: 'products' | 'lookbooks' | 'videos' | 'homepage_sections' }[] = [
  { key: 'max_products', label: 'Products', usage: 'products' },
  { key: 'max_photos_per_product', label: 'Photos per product' },
  { key: 'max_homepage_sections', label: 'Homepage sections', usage: 'homepage_sections' },
  { key: 'max_lookbooks', label: 'Lookbooks', usage: 'lookbooks' },
  { key: 'max_videos', label: 'Videos', usage: 'videos' },
];

export interface Entitlements {
  package: { id: string; name: string; price_php: number };
  features: Record<FeatureKey, boolean>;
  overrides: Partial<Record<FeatureKey, boolean>>;
  limits: Record<LimitKey, number | null>;
  usage: { products: number; lookbooks: number; videos: number; homepage_sections: number };
}

interface Api {
  ent: Entitlements | null;
  loading: boolean;
  /** Features default to allowed if the package can't be loaded: the database enforces the real rules either way. */
  can: (f: FeatureKey) => boolean;
  limit: (k: LimitKey) => number | null;
  reload: () => Promise<void>;
}
const Ctx = createContext<Api | null>(null);

export function EntitlementsProvider({ children }: { children: ReactNode }) {
  const { activeStore } = useAuth();
  const storeId = activeStore?.store_id;
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!storeId) return;
    const { data } = await supabase.rpc('my_entitlements', { p_store_id: storeId });
    setEnt((data ?? null) as Entitlements | null);
    setLoading(false);
  }, [storeId]);

  useEffect(() => { setLoading(true); setEnt(null); reload(); }, [reload]);

  const value = useMemo<Api>(() => ({
    ent, loading, reload,
    can: (f) => (ent ? Boolean(ent.features[f]) : true),
    limit: (k) => (ent ? ent.limits[k] ?? null : null),
  }), [ent, loading, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEntitlements(): Api {
  const c = useContext(Ctx);
  if (!c) throw new Error('useEntitlements must be used inside EntitlementsProvider');
  return c;
}

export const peso = (n: number) => `₱${Number(n).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
