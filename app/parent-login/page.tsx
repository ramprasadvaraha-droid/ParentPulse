'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { authenticateParent, savePortalSession } from '@/lib/portal-auth';

export default function ParentLoginPage() {
  const router = useRouter();
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const session = authenticateParent(studentName, studentId, mobile);
    if (!session) {
      setError('These details did not match a student record. Check the name, student ID, and registered parent mobile.');
      return;
    }

    savePortalSession(session);
    router.push('/parent');
  };

  return (
    <main className="portal-workspace grid min-h-screen px-4 py-10 text-[#15251f] lg:grid-cols-[0.85fr_1fr] lg:px-0 lg:py-0">
      <aside className="hidden flex-col justify-between bg-[#174d3b] p-10 text-white lg:flex">
        <div className="text-sm font-semibold">ParentPulse / Parent Portal</div>
        <div className="max-w-lg pb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b6d9c4]">Family access</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight">Your child&apos;s updates, in a private space.</h1>
          <p className="mt-5 text-sm leading-6 text-[#d7e8dd]">Your credentials are matched to the student&apos;s registered record before portal details are shown.</p>
        </div>
        <p className="text-xs text-[#b6d9c4]">Local demo only · Portal data is not production-secured</p>
      </aside>

      <section className="flex items-center justify-center px-2 py-8 lg:px-12">
        <div className="w-full max-w-md">
          <Link href="/" className="text-sm font-semibold text-[#287552] hover:underline">← ParentPulse home</Link>
          <p className="mt-10 text-xs font-semibold uppercase tracking-[0.15em] text-[#397557]">Parent Portal</p>
          <h2 className="mt-3 text-3xl font-bold text-[#15251f]">Verify your student</h2>
          <p className="mt-3 text-sm leading-6 text-[#617168]">Enter the student details and a mobile number registered with the institution.</p>

          <form onSubmit={submit} className="portal-panel mt-8 space-y-5 p-6">
            <div>
              <label htmlFor="parent-student-name" className="mb-2 block text-sm font-semibold">Student name</label>
              <input id="parent-student-name" autoComplete="name" required value={studentName} onChange={(event) => setStudentName(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2.5 outline-none focus:border-[#287552]" />
            </div>
            <div>
              <label htmlFor="parent-student-id" className="mb-2 block text-sm font-semibold">Student ID (eSSL)</label>
              <input id="parent-student-id" autoComplete="off" required value={studentId} onChange={(event) => setStudentId(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2.5 outline-none focus:border-[#287552]" />
            </div>
            <div>
              <label htmlFor="parent-mobile" className="mb-2 block text-sm font-semibold">Registered parent mobile</label>
              <input id="parent-mobile" type="tel" autoComplete="tel" inputMode="tel" required value={mobile} onChange={(event) => setMobile(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2.5 outline-none focus:border-[#287552]" />
            </div>
            {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
            <button type="submit" className="w-full rounded-md bg-[#174d3b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#103e30]">Continue to Parent Portal</button>
          </form>
          <p className="mt-4 text-xs leading-5 text-[#718078]">Demo-only credential matching. Use synthetic details; do not enter real student or contact information. Production authentication is not connected.</p>
          <p className="mt-5 text-sm text-[#617168]">Institution staff? <Link href="/institution-login" className="font-semibold text-[#216743] underline underline-offset-2">Go to Institution Portal</Link></p>
        </div>
      </section>
    </main>
  );
}