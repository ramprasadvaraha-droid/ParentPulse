'use client';

import { useEffect, useState } from 'react';

import { usePortalSession } from '@/lib/use-portal-session';

type PaymentCandidate = {
  id: string;
  name: string;
  studentId: string;
  parentName: string | null;
  amountDue: number;
  amountPaid: number;
  balance: number;
  status: 'PAID' | 'PENDING';
};

type PaymentStatusResponse = {
  period: string;
  summary: { paid: number; pending: number };
  paid: PaymentCandidate[];
  pending: PaymentCandidate[];
  reminders: {
    configured: boolean;
    workerRunning: boolean;
    lastStatus: string | null;
    lastAttemptAt: string | null;
  };
};

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

function CandidateList({ candidates, status }: { candidates: PaymentCandidate[]; status: 'PAID' | 'PENDING' }) {
  if (candidates.length === 0) {
    return <p className="px-5 py-8 text-center text-sm text-slate-500">No {status.toLowerCase()} candidates this month.</p>;
  }

  return (
    <ul className="divide-y divide-slate-200">
      {candidates.map((candidate) => (
        <li key={candidate.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <h3 className="font-semibold">{candidate.name}</h3>
            <p className="text-sm text-slate-500">{candidate.studentId}{candidate.parentName ? ` · Guardian: ${candidate.parentName}` : ''}</p>
          </div>
          <div className="text-sm sm:text-right">
            <p className="font-semibold">{status === 'PAID' ? currency.format(candidate.amountPaid) : `${currency.format(candidate.balance)} pending`}</p>
            <p className="text-slate-500">Fee due: {currency.format(candidate.amountDue)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function InstitutionPaymentsManager() {
  const session = usePortalSession();
  const [data, setData] = useState<PaymentStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        const response = await fetch('/api/institution/payments', { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Unable to load payment status.');
        if (active) {
          setData(result as PaymentStatusResponse);
          setError(null);
        }
      } catch (loadError: unknown) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load payment status.');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void loadData();
    const timer = window.setInterval(() => void loadData(), 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section className="portal-panel space-y-5 p-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{session?.institutionCode}</p>
          <h2 className="mt-1 text-xl font-bold">Payment status</h2>
        </div>
        {data ? <span className="text-sm text-slate-500">Current month · {data.period}</span> : null}
      </header>

      {error ? <p role="alert" className="border-l-4 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p> : null}
      {isLoading ? <p className="py-6 text-center text-sm text-slate-500">Loading payment status…</p> : null}
      {data ? (
        <>
          <section className="border-y border-slate-200 py-4" aria-label="WhatsApp fee reminders">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">WhatsApp fee reminders</h3>
              <span className={`text-sm font-semibold ${data.reminders.configured && data.reminders.workerRunning ? 'text-emerald-800' : 'text-amber-800'}`}>
                {data.reminders.configured
                  ? data.reminders.workerRunning ? 'Automation running' : 'Worker not running'
                  : 'Credentials not configured'}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {data.reminders.configured
                ? data.reminders.workerRunning
                  ? 'Sends every other day after the join-date deadline until the fee is paid.'
                  : 'Start the local reminders:run process to enable automatic messages.'
                : 'Configure the WhatsApp Cloud API credentials and approved fee-reminder template to enable messages.'}
            </p>
            {data.reminders.lastStatus ? (
              <p className="mt-1 text-xs text-slate-500">
                Last reminder: {data.reminders.lastStatus.toLowerCase()}
                {data.reminders.lastAttemptAt ? ` · ${new Date(data.reminders.lastAttemptAt).toLocaleString()}` : ''}
              </p>
            ) : null}
          </section>
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-medium text-emerald-900">Paid candidates</p>
              <p className="mt-1 text-2xl font-bold text-emerald-950">{data.summary.paid}</p>
            </article>
            <article className="rounded-md border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">Pending candidates</p>
              <p className="mt-1 text-2xl font-bold text-amber-950">{data.summary.pending}</p>
            </article>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <section className="overflow-hidden rounded-md border border-slate-200">
              <header className="border-b border-slate-200 bg-emerald-50 px-5 py-3">
                <h3 className="font-semibold text-emerald-950">Paid</h3>
              </header>
              <CandidateList candidates={data.paid} status="PAID" />
            </section>
            <section className="overflow-hidden rounded-md border border-slate-200">
              <header className="border-b border-slate-200 bg-amber-50 px-5 py-3">
                <h3 className="font-semibold text-amber-950">Pending</h3>
              </header>
              <CandidateList candidates={data.pending} status="PENDING" />
            </section>
          </div>
        </>
      ) : null}
    </section>
  );
}
