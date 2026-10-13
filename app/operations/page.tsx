'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import PortalAuthGate from '../../components/PortalAuthGate';
import {
  createLeaveRequest,
  ingestEsslPunch,
  reviewLeaveRequest,
  type DeviceState,
  type GateDirection,
} from '@/lib/device-leave';
import { mockStudents } from '@/lib/mock-data';
import { clearPortalSession } from '@/lib/portal-auth';
import { initialGateEvents, useGateEvents } from '@/lib/use-gate-events';
import { useLeaveRequests } from '@/lib/use-leave-requests';
import { usePortalSession } from '@/lib/use-portal-session';

const initialDeviceState: DeviceState = {
  devices: [
    {
      id: 'device-demo-01',
      institution_id: 'institution-demo',
      serial: 'ESSL-DEVICE-01',
      secret_hash: '$2b$04$3Y.U0OchrkdZwCRmp/LRd.wI03rN7oD7t15ziDUKsLGAkhuDNe6h6',
      last_heartbeat_at: '2026-10-12T09:42:00.000Z',
    },
  ],
  students: mockStudents.map((student, index) => ({
    id: student.id,
    institution_id: 'institution-demo',
    name: student.name,
    essl_id: student.essl_id,
    status: student.status,
    current_status: index % 3 === 0 ? 'OUTSIDE' : 'INSIDE',
  })),
  gateLogs: initialGateEvents,
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(`${value}T00:00:00.000Z`));

function OperationsDashboard() {
  const router = useRouter();
  const session = usePortalSession();
  const [view, setView] = useState<'gate' | 'leave'>('gate');
  const [deviceState, setDeviceState] = useState(initialDeviceState);
  const [gateEvents, setGateEvents] = useGateEvents();
  const [leaveRequests, setLeaveRequests] = useLeaveRequests();
  const [selectedStudentId, setSelectedStudentId] = useState(
    initialDeviceState.students[0]?.id ?? '',
  );
  const [direction, setDirection] = useState<GateDirection>('OUT');
  const [punchTime, setPunchTime] = useState('2026-10-12T12:00:00.000Z');
  const [leaveFilter, setLeaveFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>(
    'PENDING',
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const device = deviceState.devices[0];
  const pendingCount = leaveRequests.filter((request) => request.status === 'PENDING').length;
  const visibleLeaveRequests = useMemo(
    () =>
      leaveRequests.filter(
        (request) => leaveFilter === 'ALL' || request.status === leaveFilter,
      ),
    [leaveFilter, leaveRequests],
  );

  if (session?.role === 'ADMIN' && session.institutionCode !== 'HOSTEL-A') {
    return (
      <main className="portal-workspace grid min-h-screen place-items-center px-4 text-slate-700">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold">No demo gate records are configured</h1>
          <p className="mt-2 text-sm">This workspace will not display another institution&apos;s gate or leave data.</p>
        </div>
      </main>
    );
  }

  const processPunch = async () => {
    const student = deviceState.students.find((candidate) => candidate.id === selectedStudentId);
    if (!device || !student) {
      setError('Select a registered student before simulating a scan.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setNotice(null);
    try {
      const nextState = await ingestEsslPunch(
        { ...deviceState, gateLogs: gateEvents },
        {
          institutionId: device.institution_id,
          serial: device.serial,
          secret: 'demo-device-secret',
          esslId: student.essl_id,
          direction,
          punchTime,
          rawPayload: { source: 'operations-demo' },
        },
      );
      setDeviceState(nextState);
      setGateEvents(nextState.gateLogs);
      setNotice(
        nextState.result === 'duplicate'
          ? 'Repeated event ignored. No duplicate gate log was added.'
          : nextState.result === 'unauthorized'
            ? `Scan logged as unauthorized for ${student.name}. Resident status was not changed.`
            : `${student.name} marked ${direction === 'IN' ? 'inside' : 'outside'}; gate event recorded.`,
      );
    } catch (processingError) {
      setError(
        processingError instanceof Error ? processingError.message : 'Unable to process device event.',
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const reviewRequest = (requestId: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      setLeaveRequests(reviewLeaveRequest(leaveRequests, requestId, decision, 'warden-demo'));
      setError(null);
      setNotice(`Leave request ${decision.toLowerCase()}.`);
    } catch (reviewError) {
      setNotice(null);
      setError(reviewError instanceof Error ? reviewError.message : 'Unable to review request.');
    }
  };

  const addDemoLeaveRequest = () => {
    const student = deviceState.students[0];
    if (!student) return;

    try {
      const request = createLeaveRequest(leaveRequests, {
        institution_id: student.institution_id,
        student_id: student.id,
        student_name: student.name,
        start_date: '2026-10-24',
        end_date: '2026-10-25',
        reason: 'Weekend home visit',
      });
      setLeaveRequests([request, ...leaveRequests]);
      setError(null);
      setNotice('A mock leave request was added to the review queue.');
    } catch (requestError) {
      setNotice(null);
      setError(requestError instanceof Error ? requestError.message : 'Unable to add demo request.');
    }
  };

  return (
    <main className="portal-workspace min-h-screen px-4 py-6 text-slate-900 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="portal-panel flex flex-col gap-5 p-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/" className="text-sm font-semibold text-emerald-800 hover:text-emerald-950">
              ParentPulse / Home
            </Link>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Hostel operations
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-normal text-slate-950">Gate & leave desk</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/admin" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Administration
            </Link>
            <button type="button" onClick={() => { clearPortalSession(); router.replace('/institution-login'); }} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Sign out
            </button>
            <span className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
              Demo institution
            </span>
            <span className="rounded-md bg-amber-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-900">
              Mock mode
            </span>
          </div>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex rounded-md border border-slate-300 bg-white p-1" aria-label="Operations view">
            <button
              type="button"
              onClick={() => setView('gate')}
              aria-pressed={view === 'gate'}
              className={`rounded px-4 py-2 text-sm font-semibold ${view === 'gate' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Gate activity
            </button>
            <button
              type="button"
              onClick={() => setView('leave')}
              aria-pressed={view === 'leave'}
              className={`rounded px-4 py-2 text-sm font-semibold ${view === 'leave' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Leave requests <span className="ml-1 text-xs">{pendingCount}</span>
            </button>
          </div>
          <p className="text-sm text-slate-500">No live device connection or external messages are enabled.</p>
        </div>

        {notice ? (
          <div role="status" className="border-l-4 border-emerald-700 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div role="alert" className="border-l-4 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-900">
            {error}
          </div>
        ) : null}

        {view === 'gate' ? (
          <div className="grid gap-6 xl:grid-cols-[0.8fr_1.4fr]">
            <section className="space-y-5">
              <div className="portal-panel p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Registered device</p>
                    <h2 className="mt-2 text-xl font-bold">{device?.serial}</h2>
                    <p className="mt-1 text-sm text-slate-500">Local simulator · Device ID {device?.id}</p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-950">
                    <span className="h-2 w-2 rounded-full bg-amber-700" />
                    eSSL bypassed
                  </span>
                </div>
                <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-200 pt-4 text-sm">
                  <div>
                    <dt className="text-slate-500">Sample heartbeat</dt>
                    <dd className="mt-1 font-medium">{device?.last_heartbeat_at ? formatDateTime(device.last_heartbeat_at) : 'Not received'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Events today</dt>
                    <dd className="mt-1 font-medium">{gateEvents.length}</dd>
                  </div>
                </dl>
              </div>

              <div className="portal-panel p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Device simulator</p>
                    <h2 className="mt-1 text-lg font-bold">Process a sample punch</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPunchTime(new Date().toISOString())}
                    className="text-sm font-semibold text-emerald-800 hover:underline"
                  >
                    New timestamp
                  </button>
                </div>
                <label className="mt-5 block text-sm font-medium text-slate-700" htmlFor="simulated-student">
                  Student ID (eSSL)
                </label>
                <select
                  id="simulated-student"
                  value={selectedStudentId}
                  onChange={(event) => setSelectedStudentId(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5"
                >
                  {deviceState.students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} · {student.essl_id} · {student.status.toLowerCase()}
                    </option>
                  ))}
                </select>
                <div className="mt-4 grid grid-cols-2 gap-2 rounded-md bg-slate-100 p-1">
                  {(['IN', 'OUT'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={direction === value}
                      onClick={() => setDirection(value)}
                      className={`rounded px-3 py-2 text-sm font-semibold ${direction === value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'}`}
                    >
                      {value === 'IN' ? 'Entry' : 'Exit'}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-500">Timestamp: {formatDateTime(punchTime)} IST</p>
                <button
                  type="button"
                  onClick={processPunch}
                  disabled={isProcessing}
                  className="mt-4 w-full rounded-md bg-emerald-800 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60"
                >
                  {isProcessing ? 'Processing…' : 'Process simulated scan'}
                </button>
                <p className="mt-3 text-xs leading-5 text-slate-500">Submitting the same student, direction, and timestamp again demonstrates duplicate-event handling.</p>
              </div>
            </section>

            <section className="portal-panel">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Institution activity</p>
                  <h2 className="mt-1 text-lg font-bold">Recent gate events</h2>
                </div>
                <span className="text-sm text-slate-500">{gateEvents.length} recorded</span>
              </div>
              <div className="divide-y divide-slate-200">
                {[...gateEvents]
                  .sort((a, b) => Date.parse(b.punch_time) - Date.parse(a.punch_time))
                  .map((event) => {
                    const student = deviceState.students.find((candidate) => candidate.id === event.student_id);
                    return (
                      <div key={event.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md text-xs font-bold ${event.direction === 'IN' ? 'bg-emerald-100 text-emerald-900' : 'bg-orange-100 text-orange-900'}`}>
                            {event.direction}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{student?.name ?? event.essl_id}</p>
                            <p className="text-sm text-slate-500">{event.essl_id} · {formatDateTime(event.punch_time)}</p>
                          </div>
                        </div>
                        <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${event.is_authorized ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'}`}>
                          {event.is_authorized ? 'Authorized' : 'Unauthorized'}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </section>
          </div>
        ) : (
          <section className="portal-panel">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Warden review</p>
                <h2 className="mt-1 text-xl font-bold">Leave requests</h2>
                <p className="mt-1 text-sm text-slate-500">{pendingCount} awaiting a decision</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex rounded-md border border-slate-300 bg-white p-1" aria-label="Filter leave requests">
                  {(['PENDING', 'ALL', 'APPROVED', 'REJECTED'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      aria-pressed={leaveFilter === filter}
                      onClick={() => setLeaveFilter(filter)}
                      className={`rounded px-3 py-2 text-xs font-semibold ${leaveFilter === filter ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      {filter === 'ALL' ? 'All' : filter.charAt(0) + filter.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addDemoLeaveRequest}
                  className="rounded-md border border-emerald-800 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
                >
                  Add mock request
                </button>
              </div>
            </div>
            <div className="divide-y divide-slate-200">
              {visibleLeaveRequests.length === 0 ? (
                <p className="px-5 py-12 text-center text-sm text-slate-500">No requests in this view.</p>
              ) : (
                visibleLeaveRequests.map((request) => (
                  <article key={request.id} className="grid gap-4 px-5 py-5 lg:grid-cols-[1fr_1.2fr_auto] lg:items-center">
                    <div>
                      <h3 className="font-semibold">{request.student_name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{request.reason}</p>
                    </div>
                    <div className="text-sm text-slate-600">
                      <span className="font-medium text-slate-900">{formatDate(request.start_date)}</span>
                      <span className="px-2 text-slate-400">to</span>
                      <span className="font-medium text-slate-900">{formatDate(request.end_date)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`mr-2 rounded-full px-3 py-1 text-xs font-semibold ${request.status === 'PENDING' ? 'bg-amber-100 text-amber-900' : request.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'}`}>
                        {request.status}
                      </span>
                      {request.status === 'PENDING' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => reviewRequest(request.id, 'APPROVED')}
                            className="rounded-md bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => reviewRequest(request.id, 'REJECTED')}
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-500">Reviewed {request.processed_at ? formatDateTime(request.processed_at) : ''}</span>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

export default function OperationsPage() {
  return (
    <PortalAuthGate portal="institution">
      <OperationsDashboard />
    </PortalAuthGate>
  );
}