'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import InstitutionFacilitiesManager from './InstitutionFacilitiesManager';
import { clearPortalSession } from '@/lib/portal-auth';
import { usePortalSession } from '@/lib/use-portal-session';
import type { InstitutionRecord } from '@/lib/institutions';

type PlatformInstitution = Omit<InstitutionRecord, 'status'> & {
  status: InstitutionRecord['status'] | 'SUSPENDED';
  adminEmail?: string | null;
  createdAt?: string;
};

type CreatedAccess = {
  name: string;
  code: string;
  email: string;
  password: string;
};

export default function PlatformDashboard() {
  const router = useRouter();
  const session = usePortalSession();
  const [institutions, setInstitutions] = useState<PlatformInstitution[]>([]);
  const [selectedInstitution, setSelectedInstitution] = useState<PlatformInstitution | null>(null);
  const [createdAccess, setCreatedAccess] = useState<CreatedAccess | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/admin/institutions', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Unable to load institutions.');
        if (active) setInstitutions(result.institutions as PlatformInstitution[]);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load institutions.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, []);

  const createInstitution = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCreating(true);
    setCreatedAccess(null);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/admin/institutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code, adminName, adminEmail }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to create institution.');

      const institution = result.institution as PlatformInstitution;
      setInstitutions((current) => [...current, institution]);
      setCreatedAccess({
        name: institution.name,
        code: institution.code,
        email: institution.adminEmail ?? adminEmail,
        password: result.temporaryPassword as string,
      });
      setName('');
      setCode('');
      setAdminName('');
      setAdminEmail('');
      setNotice(`${institution.name} was provisioned.`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create institution.');
    } finally {
      setIsCreating(false);
    }
  };

  if (selectedInstitution) {
    return (
      <InstitutionFacilitiesManager
        institutionId={selectedInstitution.id}
        institutionCode={selectedInstitution.code}
        institutionName={selectedInstitution.name}
        setupHref="/platform"
      />
    );
  }

  return (
    <main className="portal-workspace min-h-screen px-4 py-6 text-slate-900 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="portal-panel flex flex-wrap items-end justify-between gap-4 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">ParentPulse platform</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-950">Institution provisioning</h1>
            <p className="mt-2 text-sm text-slate-600">Signed in as {session?.userEmail}</p>
          </div>
          <button type="button" onClick={() => { clearPortalSession(); router.replace('/platform-login'); }} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Sign out</button>
        </header>

        {notice ? <p role="status" className="border-l-4 border-emerald-700 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">{notice}</p> : null}
        {error ? <p role="alert" className="border-l-4 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p> : null}

        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-5">
            <form onSubmit={createInstitution} className="portal-panel space-y-4 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">New institution</p>
                <h2 className="mt-1 text-lg font-bold">Provision staff credentials</h2>
              </div>
              <label className="block text-sm font-medium" htmlFor="platform-institution-name">Institution name</label>
              <input id="platform-institution-name" required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="-mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5" />
              <label className="block text-sm font-medium" htmlFor="platform-institution-code">Institution code</label>
              <input id="platform-institution-code" required minLength={2} maxLength={20} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} className="-mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 uppercase" />
              <label className="block text-sm font-medium" htmlFor="platform-admin-name">Institution administrator</label>
              <input id="platform-admin-name" required minLength={2} maxLength={120} value={adminName} onChange={(event) => setAdminName(event.target.value)} className="-mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5" />
              <label className="block text-sm font-medium" htmlFor="platform-admin-email">Administrator email</label>
              <input id="platform-admin-email" type="email" required value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} className="-mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5" />
              <button type="submit" disabled={isCreating} className="w-full rounded-md bg-emerald-800 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">{isCreating ? 'Provisioning…' : 'Create institution credentials'}</button>
            </form>

            {createdAccess ? (
              <section className="portal-panel border-l-4 border-emerald-700 p-5" role="status">
                <h2 className="font-bold">Share credentials securely</h2>
                <p className="mt-2 text-sm">{createdAccess.name} · {createdAccess.code}</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div><dt className="font-semibold">Institution sign-in</dt><dd>{createdAccess.email}</dd></div>
                  <div><dt className="font-semibold">Temporary password</dt><dd className="break-all font-mono">{createdAccess.password}</dd></div>
                </dl>
                <p className="mt-3 text-xs text-slate-500">This password is only shown here until you leave or reload. Share it using a secure channel.</p>
              </section>
            ) : null}
          </div>

          <section className="portal-panel">
            <header className="flex items-end justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Platform directory</p><h2 className="mt-1 text-lg font-bold">Institutions</h2></div>
              <span className="text-sm font-semibold text-emerald-800">{isLoading ? 'Loading…' : `${institutions.length} institutions`}</span>
            </header>
            <div className="divide-y divide-slate-200">
              {institutions.map((institution) => (
                <article key={institution.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1.2fr_0.7fr_1fr_auto] sm:items-center">
                  <div><h3 className="font-semibold">{institution.name}</h3><p className="text-sm text-slate-500">{institution.code}</p></div>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${institution.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>{institution.status}</span>
                  <span className="text-sm text-slate-600">{institution.adminEmail ?? 'No active administrator'}</span>
                  <button type="button" onClick={() => setSelectedInstitution(institution)} className="w-fit rounded-md border border-emerald-800 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">Manage floors & rooms</button>
                </article>
              ))}
              {!isLoading && institutions.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-500">No institutions provisioned yet.</p> : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}