'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import PortalAuthGate from '../../components/PortalAuthGate';
import InstitutionFacilitiesManager from '../../components/InstitutionFacilitiesManager';
import InstitutionPaymentsManager from '../../components/InstitutionPaymentsManager';
import { mockRooms, mockStudents } from '@/lib/mock-data';
import {
  evaluateAbsenceAlerts,
  getFeeBalance,
  queueAlertNotifications,
  recordManualFeePayment,
  type AbsenceAlert,
  type FeeLedgerState,
  type PaymentMode,
  type NotificationQueueItem,
} from '@/lib/fee-alerts';
import type { DeviceStudent } from '@/lib/device-leave';
import type { InstitutionRecord } from '@/lib/institutions';
import { clearPortalSession } from '@/lib/portal-auth';
import { useGateEvents } from '@/lib/use-gate-events';
import { useLeaveRequests } from '@/lib/use-leave-requests';
import { usePortalSession } from '@/lib/use-portal-session';
import { useInstitutionDirectory } from '@/lib/use-institution-directory';

const institutionId = 'institution-demo';
const staffId = 'accountant-demo';
type AdminView = 'overview' | 'fees' | 'alerts' | 'institutions';
type CreatedInstitutionCredentials = {
  institutionName: string;
  institutionCode: string;
  adminEmail: string;
  password: string;
};
type InstitutionDirectoryEntry = Omit<InstitutionRecord, 'status'> & {
  status: InstitutionRecord['status'] | 'SUSPENDED';
  adminEmail?: string | null;
  createdAt?: string;
};

function subscribeToLocation(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

function getAdminViewFromUrl(): AdminView {
  if (typeof window === 'undefined') return 'overview';
  const requestedView = new URLSearchParams(window.location.search).get('view');
  return requestedView === 'fees' || requestedView === 'alerts' || requestedView === 'institutions'
    ? requestedView
    : 'overview';
}

const initialLedger: FeeLedgerState = {
  dues: mockStudents.slice(0, 6).map((student) => ({
    id: `due-2026-10-${student.id}`,
    institution_id: institutionId,
    student_id: student.id,
    student_name: student.name,
    month: 10,
    year: 2026,
    amount_due: student.monthly_fee,
    due_date: '2026-10-10',
    status: 'PENDING',
  })),
  payments: [
    {
      id: 'payment-demo-1',
      institution_id: institutionId,
      due_id: 'due-2026-10-student-2',
      amount: 1300,
      mode: 'CASH',
      reference_note: 'Counter collection',
      paid_on: '2026-10-05T09:00:00.000Z',
      recorded_by: staffId,
      is_reversal: false,
      reversal_of: null,
    },
  ],
  receipts: [
    {
      id: 'receipt-demo-1',
      institution_id: institutionId,
      due_id: 'due-2026-10-student-2',
      receipt_number: 'PP-202610-DEMO01',
      amount: 1300,
      issued_at: '2026-10-05T09:00:00.000Z',
    },
  ],
};

const alertStudents: DeviceStudent[] = mockStudents.map((student) => ({
  id: student.id,
  institution_id: institutionId,
  name: student.name,
  essl_id: student.essl_id,
  status: student.status,
  current_status: 'OUTSIDE',
}));

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));

function AdminDashboard() {
  const router = useRouter();
  const session = usePortalSession();
  const localInstitutions = useInstitutionDirectory();
  const isPlatformAdmin = session?.role === 'SUPER_ADMIN';
  const [platformInstitutions, setPlatformInstitutions] = useState<InstitutionDirectoryEntry[]>([]);
  const [hasLoadedInstitutions, setHasLoadedInstitutions] = useState(false);
  const [isCreatingInstitution, setIsCreatingInstitution] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<CreatedInstitutionCredentials | null>(null);
  const institutions: InstitutionDirectoryEntry[] = isPlatformAdmin ? platformInstitutions : localInstitutions;
  const [viewOverride, setViewOverride] = useState<AdminView | null>(null);
  const requestedView = useSyncExternalStore(subscribeToLocation, getAdminViewFromUrl, () => 'overview');
  const [gateEvents] = useGateEvents();
  const [leaveRequests] = useLeaveRequests();
  const selectedInstitutionCode = session?.institutionCode ?? 'HOSTEL-A';
  const requestedViewState = viewOverride ?? requestedView;
  const view = isPlatformAdmin
    ? 'institutions'
    : requestedViewState === 'institutions'
      ? 'overview'
      : requestedViewState;
  const [ledger, setLedger] = useState(initialLedger);
  const [alerts, setAlerts] = useState<AbsenceAlert[]>([]);
  const [notificationQueue, setNotificationQueue] = useState<NotificationQueueItem[]>([]);
  const [dueId, setDueId] = useState(initialLedger.dues[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<PaymentMode>('CASH');
  const [referenceNote, setReferenceNote] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newInstitutionName, setNewInstitutionName] = useState('');
  const [newInstitutionCode, setNewInstitutionCode] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [facilitiesInstitution, setFacilitiesInstitution] = useState<InstitutionDirectoryEntry | null>(null);

  useEffect(() => {
    if (!isPlatformAdmin) return;
    let active = true;
    fetch('/api/admin/institutions', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Unable to load institutions.');
        if (active) setPlatformInstitutions(result.institutions as InstitutionDirectoryEntry[]);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load institutions.');
      })
      .finally(() => {
        if (active) setHasLoadedInstitutions(true);
      });
    return () => { active = false; };
  }, [isPlatformAdmin]);

  useEffect(() => {
    if (selectedInstitutionCode !== 'HOSTEL-A' || isPlatformAdmin) return;
    const evaluate = () => {
      const now = new Date().toISOString();
      const created = evaluateAbsenceAlerts(alertStudents, gateEvents, alerts, now, leaveRequests);
      if (!created.length) return;

      setAlerts((current) => [...current, ...created]);
      setNotificationQueue((current) => [
        ...queueAlertNotifications(created, now),
        ...current,
      ]);
    };

    evaluate();
    const timer = window.setInterval(evaluate, 60_000);
    return () => window.clearInterval(timer);
  }, [alerts, gateEvents, isPlatformAdmin, leaveRequests, selectedInstitutionCode]);

  const selectedInstitution = institutions.find(
    (institution) => institution.code === selectedInstitutionCode,
  ) ?? institutions[0];
  const outstanding = useMemo(
    () => ledger.dues.reduce((total, due) => total + getFeeBalance(due, ledger.payments), 0),
    [ledger],
  );
  const pendingDues = ledger.dues.filter((due) => getFeeBalance(due, ledger.payments) > 0).length;

  const recordCollection = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const nextLedger = recordManualFeePayment(ledger, {
        institution_id: institutionId,
        due_id: dueId,
        amount: Number(amount),
        mode,
        reference_note: referenceNote,
        paid_on: new Date().toISOString(),
        recorded_by: staffId,
      });
      setLedger(nextLedger);
      setFeedback('Collection recorded and receipt issued. No payment was processed by ParentPulse.');
      setError(null);
      setAmount('');
      setReferenceNote('');
    } catch (recordError) {
      setFeedback(null);
      setError(recordError instanceof Error ? recordError.message : 'Unable to record collection.');
    }
  };

  const createInstitution = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isPlatformAdmin) return;
    setIsCreatingInstitution(true);
    setCreatedCredentials(null);
    try {
      const response = await fetch('/api/admin/institutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newInstitutionName,
          code: newInstitutionCode,
          adminName: newAdminName,
          adminEmail: newAdminEmail,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to create institution.');

      const institution = result.institution as InstitutionDirectoryEntry;
      setPlatformInstitutions((current) => [...current, institution]);
      setCreatedCredentials({
        institutionName: institution.name,
        institutionCode: institution.code,
        adminEmail: institution.adminEmail ?? newAdminEmail,
        password: result.temporaryPassword as string,
      });
      setFeedback(`${institution.name} and its administrator account were created.`);
      setError(null);
      setNewInstitutionName('');
      setNewInstitutionCode('');
      setNewAdminName('');
      setNewAdminEmail('');
    } catch (registrationError) {
      setFeedback(null);
      setError(registrationError instanceof Error ? registrationError.message : 'Unable to register institution.');
    } finally {
      setIsCreatingInstitution(false);
    }
  };

  if (session?.role === 'ADMIN' && selectedInstitutionCode !== 'HOSTEL-A') {
    return (
      <main className="portal-workspace min-h-screen px-4 py-6 text-slate-900 md:px-8 md:py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="portal-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Institution dashboard</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-950">{selectedInstitutionCode}</h1>
            </div>
            <button type="button" onClick={() => { clearPortalSession(); router.replace('/institution-login'); }} className="w-fit rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Sign out</button>
          </header>

          <section aria-label="Institution workspace options">
            <div className="grid gap-4 md:grid-cols-3">
              <Link href="/students#rooms" className="portal-panel p-5 transition hover:border-emerald-700">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workspace</p>
                <h2 className="mt-2 text-xl font-bold">Rooms</h2>
                <p className="mt-2 text-sm text-slate-600">View room capacity and allocation.</p>
              </Link>
              <Link href="/students/records" className="portal-panel p-5 transition hover:border-emerald-700">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workspace</p>
                <h2 className="mt-2 text-xl font-bold">Students</h2>
                <p className="mt-2 text-sm text-slate-600">Manage this institution&apos;s student records.</p>
              </Link>
              <button type="button" onClick={() => setViewOverride('fees')} className="portal-panel p-5 text-left transition hover:border-emerald-700">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workspace</p>
                <h2 className="mt-2 text-xl font-bold">Payments</h2>
                <p className="mt-2 text-sm text-slate-600">Review recorded collections and balances.</p>
              </button>
            </div>
          </section>

          {view === 'fees' ? (
            <InstitutionPaymentsManager />
          ) : null}
        </div>
      </main>
    );
  }

  if (isPlatformAdmin && facilitiesInstitution) {
    return (
      <InstitutionFacilitiesManager
        institutionId={facilitiesInstitution.id}
        institutionCode={facilitiesInstitution.code}
        institutionName={facilitiesInstitution.name}
      />
    );
  }

  return (
    <main className="portal-workspace min-h-screen px-4 py-6 text-slate-900 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="portal-panel flex flex-col gap-4 p-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/" className="text-sm font-semibold text-emerald-800 hover:text-emerald-950">
              ParentPulse / Home
            </Link>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Institution administration</p>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{isPlatformAdmin ? 'Employer / Owner Portal' : 'Institution administration'}</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-950">{isPlatformAdmin ? 'Institution accounts' : selectedInstitution?.name ?? 'Institution administration'}</h1>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm font-semibold">
            {!isPlatformAdmin ? <Link href="/students" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700 hover:bg-slate-50">Student registration</Link> : null}
            {!isPlatformAdmin ? <Link href="/operations" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700 hover:bg-slate-50">Gate & leave</Link> : null}
            <button type="button" onClick={() => { clearPortalSession(); router.replace('/institution-login'); }} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700 hover:bg-slate-50">Sign out</button>
          </nav>
        </header>

        {!isPlatformAdmin ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <nav className="flex flex-wrap gap-1 rounded-md border border-slate-300 bg-white p-1" aria-label="Administration sections">
            {([
              ['overview', 'Overview'],
              ['fees', 'Fee ledger'],
              ['alerts', 'Alerts'],
              ['institutions', 'Institutions'],
            ] as const).filter(([key]) => key !== 'institutions' || isPlatformAdmin).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => setViewOverride(key)}
                className={`rounded px-3 py-2 text-sm font-semibold ${view === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {label}
              </button>
            ))}
          </nav>
          {view !== 'institutions' ? (
            <span className="rounded-md bg-amber-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-900">Mock mode</span>
          ) : null}
        </div>
        ) : null}

        {feedback ? <div role="status" className="border-l-4 border-emerald-700 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">{feedback}</div> : null}
        {error ? <div role="alert" className="border-l-4 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}

        {view === 'overview' ? (
          <section className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Active residents', mockStudents.filter((student) => student.status === 'ACTIVE').length.toString(), 'Across the demo institution'],
                ['Bed capacity', mockRooms.reduce((sum, room) => sum + room.total_beds, 0).toString(), 'Room inventory'],
                ['Outstanding fees', formatMoney(outstanding), `${pendingDues} balances open`],
                ['Queued alerts', notificationQueue.length.toString(), 'External delivery disabled'],
              ].map(([label, value, detail]) => (
                <article key={label} className="portal-panel p-5">
                  <p className="text-sm font-medium text-slate-500">{label}</p>
                  <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
                  <p className="mt-2 text-xs text-slate-500">{detail}</p>
                </article>
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
              <section className="portal-panel p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current operations</p>
                    <h2 className="mt-1 text-lg font-bold">Staff workspace</h2>
                  </div>
                  <Link href="/operations" className="text-sm font-semibold text-emerald-800 hover:underline">Open desk</Link>
                </div>
                <div className="mt-5 divide-y divide-slate-200">
                  <div className="flex items-center justify-between py-3 text-sm"><span>Pending leave decisions</span><span className="font-semibold">2 requests</span></div>
                  <div className="flex items-center justify-between py-3 text-sm"><span>eSSL service</span><span className="font-semibold text-amber-800">Bypassed · simulator only</span></div>
                  <div className="flex items-center justify-between py-3 text-sm"><span>WhatsApp delivery</span><span className="font-semibold text-slate-600">Status shown under Payments</span></div>
                </div>
              </section>
              <section className="portal-panel p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Product boundary</p>
                <h2 className="mt-1 text-lg font-bold">Collections stay offline</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">Staff can record a collection received through their own channel and issue a ledger receipt. ParentPulse does not process or initiate a payment.</p>
              </section>
            </div>
            <section className="border-t border-slate-300 pt-5" aria-label="Institution portal features">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Institution portal</p>
              <div className="mt-4 grid gap-6 md:grid-cols-3">
                <article><p className="text-sm font-semibold text-emerald-800">01 / Presence</p><h2 className="mt-2 text-lg font-bold">Gate activity at a glance</h2><p className="mt-2 text-sm leading-6 text-slate-600">Review entry and exit events and keep student whereabouts visible to the right people.</p></article>
                <article><p className="text-sm font-semibold text-emerald-800">02 / Leave</p><h2 className="mt-2 text-lg font-bold">Clear leave updates</h2><p className="mt-2 text-sm leading-6 text-slate-600">Families submit requests while wardens review decisions and keep a shared history.</p></article>
                <article><p className="text-sm font-semibold text-emerald-800">03 / Records</p><h2 className="mt-2 text-lg font-bold">Useful hostel records</h2><p className="mt-2 text-sm leading-6 text-slate-600">Staff manage rooms, manually recorded fee collections, receipts, and institution status.</p></article>
              </div>
            </section>
          </section>
        ) : null}

        {view === 'fees' ? (
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <section className="portal-panel">
              <div className="border-b border-slate-200 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Manual fee tracking</p>
                <h2 className="mt-1 text-lg font-bold">October 2026 ledger</h2>
              </div>
              <div className="divide-y divide-slate-200">
                {ledger.dues.map((due) => {
                  const balance = getFeeBalance(due, ledger.payments);
                  return (
                    <article key={due.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                      <div><h3 className="font-semibold">{due.student_name}</h3><p className="text-sm text-slate-500">Due {due.due_date} · {formatMoney(due.amount_due)}</p></div>
                      <span className="text-sm font-semibold">{balance ? `${formatMoney(balance)} remaining` : 'Settled'}</span>
                      <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${balance ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>{balance ? due.status : 'PAID'}</span>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="space-y-5">
              <form onSubmit={recordCollection} className="portal-panel space-y-4 p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Staff action</p>
                  <h2 className="mt-1 text-lg font-bold">Record a collection received</h2>
                  <p className="mt-2 text-sm text-slate-600">This records an offline collection only. It does not initiate, accept, or transfer funds.</p>
                </div>
                <label className="block text-sm font-medium" htmlFor="fee-due">Student balance</label>
                <select id="fee-due" value={dueId} onChange={(event) => setDueId(event.target.value)} className="-mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5">
                  {ledger.dues.map((due) => <option key={due.id} value={due.id}>{due.student_name} · {formatMoney(getFeeBalance(due, ledger.payments))} remaining</option>)}
                </select>
                <label className="block text-sm font-medium" htmlFor="collection-amount">Amount recorded</label>
                <input id="collection-amount" type="number" min="0.01" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} className="-mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5" />
                <label className="block text-sm font-medium" htmlFor="collection-mode">Received by</label>
                <select id="collection-mode" value={mode} onChange={(event) => setMode(event.target.value as PaymentMode)} className="-mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5">
                  <option value="CASH">Cash</option><option value="UPI">UPI received externally</option><option value="BANK_TRANSFER">Bank transfer received</option><option value="CHEQUE">Cheque</option><option value="OTHER">Other</option>
                </select>
                <label className="block text-sm font-medium" htmlFor="collection-reference">Reference note <span className="font-normal text-slate-500">(optional)</span></label>
                <input id="collection-reference" value={referenceNote} onChange={(event) => setReferenceNote(event.target.value)} className="-mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5" />
                <button type="submit" className="w-full rounded-md bg-emerald-800 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-900">Record and issue receipt</button>
              </form>
              <section className="portal-panel p-5">
                <h2 className="text-lg font-bold">Recent receipts</h2>
                {ledger.receipts.length ? <ul className="mt-3 divide-y divide-slate-200">{[...ledger.receipts].reverse().slice(0, 4).map((receipt) => <li key={receipt.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span className="font-medium">{receipt.receipt_number}</span><span>{formatMoney(receipt.amount)}</span></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No receipts issued yet.</p>}
              </section>
            </section>
          </div>
        ) : null}

        {view === 'alerts' ? (
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <section className="portal-panel p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attendance monitoring</p><h2 className="mt-1 text-lg font-bold">Absence thresholds</h2></div>
                <span className="rounded-md bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-900">Automatic check · every minute</span>
              </div>
              <div className="mt-5 divide-y divide-slate-200">
                <div className="py-3"><p className="font-semibold">2 hours outside</p><p className="mt-1 text-sm text-slate-500">Create a warden alert for the current absence.</p></div>
                <div className="py-3"><p className="font-semibold">4 hours outside</p><p className="mt-1 text-sm text-slate-500">Create a parent/principal alert for the same absence.</p></div>
              </div>
              <p className="mt-4 border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-950">Approved parent permission suppresses alerts during its date range. Automatic checks run while this institution portal is open; external delivery is disabled.</p>
            </section>
            <section className="portal-panel">
              <div className="border-b border-slate-200 px-5 py-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Persisted in demo state</p><h2 className="mt-1 text-lg font-bold">Alert records</h2></div>
              {alerts.length ? <ul className="divide-y divide-slate-200">{alerts.map((alert) => <li key={alert.id} className="flex flex-wrap justify-between gap-2 px-5 py-4 text-sm"><span className="font-medium">{alertStudents.find((student) => student.id === alert.student_id)?.name}</span><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">{alert.level}</span></li>)}</ul> : <p className="px-5 py-10 text-center text-sm text-slate-500">No alerts evaluated yet.</p>}
            </section>
            <section className="portal-panel xl:col-span-2">
              <div className="border-b border-slate-200 px-5 py-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Provider adapter disabled</p><h2 className="mt-1 text-lg font-bold">Notification queue</h2></div>
              {notificationQueue.length ? <ul className="divide-y divide-slate-200">{notificationQueue.map((item) => <li key={item.id} className="grid gap-2 px-5 py-4 text-sm sm:grid-cols-[1fr_1fr_auto]"><span className="font-medium">{item.template_key}</span><span className="text-slate-500">{formatDateTime(item.created_at)}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{item.status}</span></li>)}</ul> : <p className="px-5 py-8 text-sm text-slate-500">No notifications queued. Nothing is sent externally in this demo.</p>}
            </section>
          </div>
        ) : null}

        {view === 'institutions' ? (
          <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-6">
              <form onSubmit={createInstitution} className="portal-panel space-y-4 p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Platform owner</p>
                  <h2 className="mt-1 text-lg font-bold">Create institution access</h2>
                  <p className="mt-2 text-sm text-slate-600">Creates an institution and its first administrator in the database.</p>
                </div>
                <label className="block text-sm font-medium" htmlFor="institution-name">Institution name</label>
                <input id="institution-name" required minLength={2} value={newInstitutionName} onChange={(event) => setNewInstitutionName(event.target.value)} className="-mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5" placeholder="Svem School" />
                <label className="block text-sm font-medium" htmlFor="institution-code">Institution code</label>
                <input id="institution-code" required minLength={2} maxLength={20} value={newInstitutionCode} onChange={(event) => setNewInstitutionCode(event.target.value)} className="-mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 uppercase" placeholder="SVEM-SCHOOL" />
                <label className="block text-sm font-medium" htmlFor="institution-admin-name">Administrator name</label>
                <input id="institution-admin-name" required minLength={2} value={newAdminName} onChange={(event) => setNewAdminName(event.target.value)} className="-mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5" autoComplete="name" />
                <label className="block text-sm font-medium" htmlFor="institution-admin-email">Administrator email</label>
                <input id="institution-admin-email" type="email" required value={newAdminEmail} onChange={(event) => setNewAdminEmail(event.target.value)} className="-mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5" autoComplete="email" />
                <button type="submit" disabled={isCreatingInstitution} className="w-full rounded-md bg-emerald-800 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">{isCreatingInstitution ? 'Creating…' : 'Create institution and credentials'}</button>
              </form>

              {createdCredentials ? (
                <section className="portal-panel border-l-4 border-emerald-700 p-5" role="status">
                  <h2 className="font-bold">Share these credentials securely</h2>
                  <p className="mt-2 text-sm">{createdCredentials.institutionName} · {createdCredentials.institutionCode}</p>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div><dt className="font-semibold">Admin login</dt><dd>{createdCredentials.adminEmail}</dd></div>
                    <div><dt className="font-semibold">Temporary password</dt><dd className="break-all font-mono">{createdCredentials.password}</dd></div>
                  </dl>
                  <p className="mt-3 text-xs text-slate-500">This password is shown only until you leave or reload this page. Share it with the administrator over a secure channel.</p>
                </section>
              ) : null}
            </div>

            <section className="portal-panel">
              <div className="flex items-end justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Platform directory</p><h2 className="mt-1 text-lg font-bold">Registered institutions</h2></div>
                <span className="text-sm font-semibold text-emerald-800" aria-live="polite">{hasLoadedInstitutions ? `${institutions.length} institutions` : 'Loading…'}</span>
              </div>
              <div className="divide-y divide-slate-200">
                {institutions.map((institution) => (
                  <article key={institution.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1.5fr_0.7fr_1.1fr_1fr_auto] sm:items-center">
                    <div><h3 className="font-semibold">{institution.name}</h3><p className="text-sm text-slate-500">{institution.code}</p></div>
                    <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${institution.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>{institution.status}</span>
                    <span className="text-sm">{institution.adminEmail ?? 'No active admin'}</span>
                    <span className="text-sm text-slate-500">{institution.createdAt ? `Created ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(institution.createdAt))}` : ''}</span>
                    <button type="button" onClick={() => setFacilitiesInstitution(institution)} className="w-fit rounded-md border border-emerald-800 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">Manage floors & rooms</button>
                  </article>
                ))}
                {hasLoadedInstitutions && institutions.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-500">No institutions provisioned yet.</p> : null}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default function AdminPage() {
  return (
    <PortalAuthGate portal="institution">
      <AdminDashboard />
    </PortalAuthGate>
  );
}