import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { SLUG_RE, errorMessage, slugify } from '@/lib/format';
import { Alert, PageHeader, Spinner } from '@/components/ui';

export default function OwnerStoreNew() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [contactEmail, setContactEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onName(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!SLUG_RE.test(slug) || slug.length < 2) {
      setError('The Store ID can only use lowercase letters, numbers and single hyphens (at least 2 characters).');
      return;
    }
    setBusy(true);
    const { data, error: err } = await supabase
      .from('stores')
      .insert({ name: name.trim(), slug, contact_email: contactEmail.trim() || null })
      .select('id')
      .single();
    setBusy(false);
    if (err) {
      setError(err.code === '23505' ? 'That Store ID is already taken. Choose another.' : errorMessage(err));
      return;
    }
    navigate(`/owner/stores/${data.id}`, { replace: true });
  }

  return (
    <div>
      <PageHeader title="New brand" description="Create the brand first, then give your client access and connect their website on the next screen." />
      <form onSubmit={onSubmit} className="card max-w-xl space-y-5 p-6">
        {error && <Alert>{error}</Alert>}
        <div>
          <label htmlFor="name" className="label">Brand name</label>
          <input id="name" required maxLength={100} className="input" value={name} onChange={(e) => onName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="slug" className="label">Store ID</label>
          <div className="flex items-center gap-2">
            <input
              id="slug"
              required
              maxLength={60}
              className="input"
              value={slug}
              onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()); }}
            />
          </div>
          <p className="hint">The website uses this ID to find its content. Lowercase letters, numbers and hyphens.</p>
        </div>
        <div>
          <label htmlFor="contact" className="label">Store contact email (optional)</label>
          <input id="contact" type="email" className="input" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          <p className="hint">Shown to customers on the website. It doesn’t give anyone access.</p>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={busy}>{busy && <Spinner />} Create brand</button>
          <Link to="/owner/stores" className="btn-quiet">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
