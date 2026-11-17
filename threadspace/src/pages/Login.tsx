import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { Alert, PageLoader, Spinner } from '@/components/ui';
import Logo from '@/components/Logo';

export default function Login() {
  const { user, loading, isOwner, memberships, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    if (from) navigate(from, { replace: true });
    else if (isOwner) navigate('/owner', { replace: true });
    else if (memberships.length > 0) navigate('/dashboard', { replace: true });
  }, [loading, user, isOwner, memberships, from, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const message = await signIn(email, password);
    setBusy(false);
    if (message) setError(message);
  }

  if (loading) return <PageLoader />;
  const signedInWithoutStore = user && !isOwner && memberships.length === 0;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-black p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo onDark />
        <img src="/pryze-mark-white.png" alt="" aria-hidden className="pointer-events-none absolute -bottom-10 -right-16 w-[34rem] max-w-none opacity-[0.07]" />
        <p className="font-display relative max-w-md text-6xl leading-[0.95]" style={{ fontWeight: 900 }}>Run your brand from one place.</p>
        <p className="relative text-sm text-white/55">Accounts are created by the Pryze.dept team.</p>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden"><Logo /></div>
          <h1 className="font-display mt-10 text-4xl lg:mt-0">Sign in</h1>
          {signedInWithoutStore ? (
            <div className="mt-6 space-y-4">
              <Alert kind="info">You’re signed in as {user.email}, but this account isn’t linked to a brand yet. Ask the Pryze.dept team to add you.</Alert>
              <button type="button" className="btn-outline" onClick={() => signOut()}>Sign out</button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {error && <Alert>{error}</Alert>}
              <div>
                <label htmlFor="email" className="label">Email</label>
                <input id="email" type="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label htmlFor="password" className="label">Password</label>
                <input id="password" type="password" autoComplete="current-password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <button type="submit" className="btn-primary w-full py-3" disabled={busy}>{busy && <Spinner />} Sign in</button>
            </form>
          )}
          <p className="mt-8 text-sm text-sand-500">Want a website for your brand? <Link to="/#contact" className="text-black underline">Get in touch</Link>.</p>
        </div>
      </div>
    </div>
  );
}
