import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { SiteSettings } from './types';

export function useSiteSettings(storeId: string | undefined) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!storeId) return;
    const { data } = await supabase.from('site_settings').select('*').eq('store_id', storeId).maybeSingle();
    setSettings((data ?? null) as SiteSettings | null);
    setLoading(false);
  }, [storeId]);
  useEffect(() => { setLoading(true); reload(); }, [reload]);
  return { settings, loading, reload };
}
