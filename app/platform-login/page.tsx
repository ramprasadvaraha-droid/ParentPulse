'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { savePortalSession, type PortalSession } from '@/lib/portal-auth';

export default function PlatformLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/platform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok || !result.session) {
        setError(result.error ?? 'Email or password is incorrect.');
        return;
      }

      savePortalSession(result.session as PortalSession);
      router.push('/platform');
    } catch {
      setError('Platform owner sign-in is temporarily unavailable.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="portal-workspace grid min-h-screen px-4 py-10 text-[#15251f] lg:grid-cols-[1fr_0.85fr] lg:px-0 lg:py-0">
      <section className="flex items-center justify-center px-2 py-8 lg:px-12">
        <div className="w-full max-w-md">
          <Link href="/" className="text-sm font-semibold text-[#287552] hover:underline">ParentPulse home</Link>
          <p className="mt-10 text-xs font-semibold uppercase tracking-[0.15em] text-[#397557]">Platform administration</p>
          <h1 className="mt-3 text-3xl font-bold text-[#15251f]">ParentPulse owner sign-in</h1>
          <p className="mt-3 text-sm leading-6 text-[#617168]">Use your platform-owner credentials to provision institutions and manage their floor and room layouts.</p>

          <form onSubmit={submit} className="portal-panel mt-8 space-y-5 p-6">
            <div>
              <label htmlFor="platform-email" className="mb-2 block text-sm font-semibold">Work email</label>
              <input id="platform-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-[#287552]" />
            </div>
            <div>
              <label htmlFor="platform-password" className="mb-2 block text-sm font-semibold">Password</label>
              <input id="platform-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-[#287552]" />
            </div>
            {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
            <button type="submit" disabled={isSubmitting} className="w-full rounded-md bg-[#174d3b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#103e30] disabled:opacity-60">{isSubmitting ? 'Signing in…' : 'Sign in to platform workspace'}</button>
          </form>
          <p className="mt-4 text-xs leading-5 text-[#718078]">This is separate from the institution staff portal.</p>
          <Link href="/institution-login" className="mt-3 inline-block text-sm font-semibold text-[#287552] hover:underline">Institution staff sign-in</Link>
        </div>
      </section>

      <aside className="hidden flex-col justify-between bg-[#174d3b] p-10 text-white lg:flex">
        <div className="text-sm font-semibold">ParentPulse / Platform</div>
        <div className="max-w-lg pb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b6d9c4]">Owner workspace</p>
          <h2 className="mt-4 text-4xl font-bold leading-tight">Provision institution access and facilities.</h2>
          <p className="mt-5 text-sm leading-6 text-[#d7e8dd]">Create institution accounts, then configure their floors, rooms, and beds without entering an institution staff portal.</p>
        </div>
        <p className="text-xs text-[#b6d9c4]">Authorized ParentPulse platform owners only</p>
      </aside>
    </main>
  );
}