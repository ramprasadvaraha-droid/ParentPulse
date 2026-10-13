'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import PortalAuthGate from '../../components/PortalAuthGate';
import {
  clearPortalSession,
} from '@/lib/portal-auth';
import {
  createLeaveRequest,
} from '@/lib/device-leave';
import { getFeeBalance, type FeeDue } from '@/lib/fee-alerts';
import { useStudentDirectory } from '@/lib/use-student-directory';
import { useLeaveRequests } from '@/lib/use-leave-requests';
import { usePortalSession } from '@/lib/use-portal-session';

const institutionId = 'institution-demo';

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(`${value}T00:00:00.000Z`));

function ParentDashboard() {
  const router = useRouter();
  const session = usePortalSession();
  const [students] = useStudentDirectory();
  const [requests, setRequests] = useLeaveRequests();
  const student = students.find((candidate) => candidate.id === session?.studentId);
  const [form, setForm] = useState({ start_date: '', end_date: '', reason: '' });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentDue: FeeDue | null = student
    ? {
        id: `due-2026-10-${student.id}`,
        institution_id: institutionId,
        student_id: student.id,
        student_name: student.name,
        month: 10,
        year: 2026,
        amount_due: student.monthly_fee,
        due_date: '2026-10-10',
        status: 'PENDING',
      }
    : null;
  const outstanding = currentDue ? getFeeBalance(currentDue, []) : 0;
  const studentRequests = requests.filter((request) => request.student_id === student?.id);

  const submitLeaveRequest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!student) return;

    try {
      const request = createLeaveRequest(requests, {
        institution_id: institutionId,
        student_id: student.id,
        student_name: student.name,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason,
      });
      setRequests([request, ...requests]);
      setForm({ start_date: '', end_date: '', reason: '' });
      setNotice('Leave request submitted for warden review.');
      setError(null);
    } catch (submissionError) {
      setNotice(null);
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to submit leave request.');
    }
  };

  const signOut = () => {
    clearPortalSession();
    router.replace('/parent-login');
  };

  if (!student) {
    return (
      <main className="portal-workspace grid min-h-screen place-items-center px-4 text-slate-700">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold">Student record unavailable</h1>
          <p className="mt-2 text-sm">Sign in again with the student name, ID, and registered parent mobile.</p>
          <Link href="/parent-login" className="mt-4 inline-block font-semibold text-emerald-800 underline">Return to Parent Portal sign-in</Link>
        </div>
      </main>
    );
  }

  const residenceStatus = student.current_status ?? 'OUTSIDE';

  return (
    <main className="portal-workspace min-h-screen px-4 py-6 text-slate-900 md:px-8 md:py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-slate-300 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/" className="text-sm font-semibold text-emerald-800 hover:text-emerald-950">ParentPulse</Link>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Parent Portal · Private student view</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-950">{student.name}</h1>
            <p className="mt-1 text-sm text-slate-500">Student ID (eSSL): {student.essl_id}</p>
          </div>
          <button type="button" onClick={signOut} className="w-fit rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Sign out</button>
        </header>

        {notice ? <div role="status" className="border-l-4 border-emerald-700 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">{notice}</div> : null}
        {error ? <div role="alert" className="border-l-4 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}

        <section className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
          <article className="portal-panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Residence status</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Currently {residenceStatus.toLowerCase()}</h2>
                <p className="mt-1 text-sm text-slate-500">Status from the institution&apos;s demo gate record.</p>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${residenceStatus === 'INSIDE' ? 'bg-emerald-100 text-emerald-900' : 'bg-orange-100 text-orange-900'}`}>{residenceStatus}</span>
            </div>
            <p className="mt-5 border-t border-slate-200 pt-4 text-sm text-slate-600">Recent movement details are shown only after parent sign-in and depend on the institution&apos;s connected gate feed.</p>
          </article>

          <article className="portal-panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fee record</p>
            <h2 className="mt-2 text-lg font-bold">October 2026</h2>
            <p className="mt-4 text-3xl font-bold">{formatMoney(outstanding)}</p>
            <p className="mt-1 text-sm text-slate-500">Balance shown from the institution&apos;s manual ledger.</p>
            <p className="mt-4 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-500">Collections are arranged directly with the institution. This portal only displays recorded balances.</p>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={submitLeaveRequest} className="portal-panel space-y-4 p-5">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Leave</p><h2 className="mt-1 text-lg font-bold">Submit a request</h2></div>
            <label className="block text-sm font-medium" htmlFor="leave-start">From</label>
            <input id="leave-start" type="date" required value={form.start_date} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} className="-mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5" />
            <label className="block text-sm font-medium" htmlFor="leave-end">Until</label>
            <input id="leave-end" type="date" required value={form.end_date} onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))} className="-mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5" />
            <label className="block text-sm font-medium" htmlFor="leave-reason">Reason</label>
            <textarea id="leave-reason" required minLength={3} value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} rows={3} className="-mt-2 w-full resize-y rounded-md border border-slate-300 px-3 py-2.5" />
            <button type="submit" className="w-full rounded-md bg-emerald-800 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-900">Send for review</button>
          </form>

          <section className="portal-panel">
            <div className="border-b border-slate-200 px-5 py-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Request history</p><h2 className="mt-1 text-lg font-bold">Leave status</h2></div>
            {studentRequests.length ? <div className="divide-y divide-slate-200">{studentRequests.map((request) => <article key={request.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"><div><p className="font-semibold">{formatDate(request.start_date)} to {formatDate(request.end_date)}</p><p className="mt-1 text-sm text-slate-500">{request.reason}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${request.status === 'PENDING' ? 'bg-amber-100 text-amber-900' : request.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'}`}>{request.status}</span></article>)}</div> : <p className="px-5 py-10 text-sm text-slate-500">No leave requests yet.</p>}
          </section>
        </section>
        <p className="text-xs text-slate-500">Demo data is stored in this browser session. This is not a production authentication system.</p>
      </div>
    </main>
  );
}

export default function ParentPage() {
  return (
    <PortalAuthGate portal="parent">
      <ParentDashboard />
    </PortalAuthGate>
  );
}