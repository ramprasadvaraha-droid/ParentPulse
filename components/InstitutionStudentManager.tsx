'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePortalSession } from '@/lib/use-portal-session';

type InstitutionStudent = {
  id: string;
  name: string;
  studentId: string;
  currentStatus: 'INSIDE' | 'OUTSIDE';
  statusSince: string;
  parentName: string | null;
  parentPhone: string | null;
  whatsappRemindersOptedIn: boolean;
  whatsappAlertsOptedIn: boolean;
  roomName: string | null;
  floor: number | null;
  bedNumber: number | null;
  joinedDate: string;
  monthlyFee: number;
};

type FacilityRoom = {
  id: string;
  name: string;
  totalBeds: number;
  occupiedBedNumbers: number[];
};

type FacilityFloor = {
  id: string;
  name: string;
  orderIndex: number;
  rooms: FacilityRoom[];
};

export default function InstitutionStudentManager({
  institutionName,
}: {
  institutionName?: string;
}) {
  const session = usePortalSession();
  const institutionCode = session?.institutionCode ?? '';
  const [students, setStudents] = useState<InstitutionStudent[]>([]);
  const [form, setForm] = useState({ name: '', studentId: '', parentName: '', parentPhone: '', whatsappRemindersOptedIn: false, whatsappAlertsOptedIn: false, joinedDate: '', monthlyFee: '', roomId: '', bedNumber: '' });
  const [floors, setFloors] = useState<FacilityFloor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        const [studentsResponse, facilitiesResponse] = await Promise.all([
          fetch('/api/institution/students', { cache: 'no-store' }),
          fetch('/api/institution/facilities', { cache: 'no-store' }),
        ]);
        const [studentsResult, facilitiesResult] = await Promise.all([
          studentsResponse.json(),
          facilitiesResponse.json(),
        ]);
        if (!facilitiesResponse.ok) throw new Error(facilitiesResult.error ?? 'Unable to load rooms.');
        if (active) {
          setFloors(facilitiesResult.floors as FacilityFloor[]);
        }
        if (!studentsResponse.ok) throw new Error(studentsResult.error ?? 'Unable to load students.');
        if (active) {
          setStudents(studentsResult.students as InstitutionStudent[]);
          setError(null);
        }
      } catch (loadError: unknown) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load students.');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void loadData();
    const refreshTimer = window.setInterval(() => void loadData(), 30_000);
    const clockTimer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
    };
  }, []);

  const updateField = (field: Exclude<keyof typeof form, 'whatsappRemindersOptedIn'>, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateReminderConsent = async (
    student: InstitutionStudent,
    consentField: 'whatsappRemindersOptedIn' | 'whatsappAlertsOptedIn',
  ) => {
    const optedIn = !student[consentField];
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/institution/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id, [consentField]: optedIn }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to update reminder consent.');
      setStudents((current) => current.map((candidate) =>
        candidate.parentPhone === student.parentPhone
          ? { ...candidate, [consentField]: result[consentField] as boolean }
          : candidate,
      ));
      setNotice(optedIn
        ? `Guardian opted in to WhatsApp ${consentField === 'whatsappRemindersOptedIn' ? 'fee reminders' : 'safety alerts'}.`
        : `WhatsApp ${consentField === 'whatsappRemindersOptedIn' ? 'fee reminders' : 'safety alerts'} disabled for this guardian.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update reminder consent.');
    }
  };

  const updateStudentStatus = async (student: InstitutionStudent) => {
    const currentStatus = student.currentStatus === 'INSIDE' ? 'OUTSIDE' : 'INSIDE';
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/institution/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id, currentStatus }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to update student status.');
      setStudents((current) => current.map((candidate) => candidate.id === student.id
        ? { ...candidate, currentStatus: result.currentStatus, statusSince: result.statusSince }
        : candidate));
      setNow(Date.now());
      setNotice(`${student.name} marked ${currentStatus.toLowerCase()}.`);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Unable to update student status.');
    }
  };

  const rooms = floors.flatMap((floor) => floor.rooms.map((room) => ({ ...room, floorName: floor.name })));
  const selectedRoom = rooms.find((room) => room.id === form.roomId);
  const availableBedNumbers = selectedRoom
    ? Array.from({ length: selectedRoom.totalBeds }, (_, index) => index + 1)
      .filter((bedNumber) => !selectedRoom.occupiedBedNumbers.includes(bedNumber))
    : [];

  const registerStudent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/institution/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, monthlyFee: Number(form.monthlyFee), bedNumber: Number(form.bedNumber) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to register student.');
      setStudents((current) => [...current, result.student as InstitutionStudent].sort((left, right) => left.name.localeCompare(right.name)));
      setNotice(`${result.student.name} was registered successfully.`);
      setForm({ name: '', studentId: '', parentName: '', parentPhone: '', whatsappRemindersOptedIn: false, whatsappAlertsOptedIn: false, joinedDate: '', monthlyFee: '', roomId: '', bedNumber: '' });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to register student.');
    } finally {
      setIsSaving(false);
    }
  };

  const insideCount = students.filter((student) => student.currentStatus === 'INSIDE').length;
  const outsideCount = students.length - insideCount;
  const formatOutsideDuration = (statusSince: string) => {
    const elapsedMinutes = Math.max(0, Math.floor((now - Date.parse(statusSince)) / 60_000));
    const hours = Math.floor(elapsedMinutes / 60);
    const minutes = elapsedMinutes % 60;
    return hours ? `${hours}h ${minutes}m outside` : `${minutes}m outside`;
  };

  return (
    <main className="portal-workspace min-h-screen px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="portal-panel flex flex-wrap items-end justify-between gap-4 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{institutionCode}</p>
            <h1 className="mt-2 text-2xl font-bold">{institutionName ? `${institutionName} · Students` : 'Students'}</h1>
          </div>
          <div className="flex gap-2">
            <a href="#add-student" className="rounded-md bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-900">Add student</a>
            <Link href="/admin" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Dashboard</Link>
          </div>
        </header>

        <section aria-label="Live student presence" className="grid gap-4 sm:grid-cols-3">
          <article className="portal-panel p-5">
            <p className="text-sm font-medium text-slate-500">Total students</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{students.length}</p>
          </article>
          <article className="portal-panel border-emerald-200 bg-emerald-50 p-5">
            <p className="text-sm font-medium text-emerald-900">Inside</p>
            <p className="mt-2 text-2xl font-bold text-emerald-950">{insideCount}</p>
          </article>
          <article className="portal-panel border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-medium text-amber-900">Outside</p>
            <p className="mt-2 text-2xl font-bold text-amber-950">{outsideCount}</p>
          </article>
        </section>

        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <form id="add-student" onSubmit={registerStudent} className="portal-panel space-y-4 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Student registration</p>
              <h2 className="mt-1 text-lg font-bold">Add a student</h2>
            </div>
            <div>
              <label htmlFor="institution-student-name" className="mb-2 block text-sm font-semibold">Student name</label>
              <input id="institution-student-name" required minLength={2} maxLength={120} autoComplete="name" value={form.name} onChange={(event) => updateField('name', event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2.5" />
            </div>
            <div>
              <label htmlFor="institution-student-id" className="mb-2 block text-sm font-semibold">Student ID / eSSL number</label>
              <input id="institution-student-id" required maxLength={40} value={form.studentId} onChange={(event) => updateField('studentId', event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2.5" placeholder="ESSL-1001" />
            </div>
            <div>
              <label htmlFor="institution-parent-name" className="mb-2 block text-sm font-semibold">Parent / guardian name</label>
              <input id="institution-parent-name" required minLength={2} maxLength={120} value={form.parentName} onChange={(event) => updateField('parentName', event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2.5" />
            </div>
            <div>
              <label htmlFor="institution-parent-phone" className="mb-2 block text-sm font-semibold">Parent / guardian phone</label>
              <input id="institution-parent-phone" type="tel" required minLength={7} maxLength={20} autoComplete="tel" inputMode="tel" value={form.parentPhone} onChange={(event) => updateField('parentPhone', event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2.5" placeholder="+91 90000 00000" />
            </div>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.whatsappRemindersOptedIn} onChange={(event) => setForm((current) => ({ ...current, whatsappRemindersOptedIn: event.target.checked }))} className="mt-1 accent-emerald-800" />
              <span>Guardian agreed to receive WhatsApp fee reminders every other day after the due date until paid.</span>
            </label>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.whatsappAlertsOptedIn} onChange={(event) => setForm((current) => ({ ...current, whatsappAlertsOptedIn: event.target.checked }))} className="mt-1 accent-emerald-800" />
              <span>Guardian agreed to receive WhatsApp safety alerts when the student is outside.</span>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="institution-student-joined-date" className="mb-2 block text-sm font-semibold">Joined date</label>
                <input id="institution-student-joined-date" type="date" required value={form.joinedDate} onChange={(event) => updateField('joinedDate', event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2.5" />
              </div>
              <div>
                <label htmlFor="institution-student-monthly-fee" className="mb-2 block text-sm font-semibold">Monthly fee</label>
                <input id="institution-student-monthly-fee" type="number" required min="0" max="10000000" step="0.01" inputMode="decimal" value={form.monthlyFee} onChange={(event) => updateField('monthlyFee', event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2.5" placeholder="0.00" />
              </div>
            </div>
            <div>
              <label htmlFor="institution-student-room" className="mb-2 block text-sm font-semibold">Room number</label>
              <select id="institution-student-room" required value={form.roomId} onChange={(event) => {
                const roomId = event.target.value;
                const room = rooms.find((option) => option.id === roomId);
                const nextBed = room
                  ? Array.from({ length: room.totalBeds }, (_, index) => index + 1).find((bed) => !room.occupiedBedNumbers.includes(bed))
                  : undefined;
                setForm((current) => ({ ...current, roomId, bedNumber: nextBed ? String(nextBed) : '' }));
              }} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5">
                <option value="">Choose a room</option>
                {rooms.map((room) => {
                  const availableCount = room.totalBeds - room.occupiedBedNumbers.length;
                  return <option key={room.id} value={room.id} disabled={availableCount <= 0}>{room.floorName} · {room.name} · {availableCount} beds available</option>;
                })}
              </select>
              {rooms.length === 0 ? <Link href="/students" className="mt-2 inline-block text-sm font-semibold text-emerald-800 underline">Add floors and rooms first</Link> : null}
            </div>
            <div>
              <label htmlFor="institution-student-bed" className="mb-2 block text-sm font-semibold">Bed number</label>
              <select id="institution-student-bed" required value={form.bedNumber} disabled={!selectedRoom || availableBedNumbers.length === 0} onChange={(event) => updateField('bedNumber', event.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 disabled:bg-slate-100">
                <option value="">{selectedRoom ? 'No beds available' : 'Choose a room first'}</option>
                {availableBedNumbers.map((bedNumber) => <option key={bedNumber} value={bedNumber}>Bed {bedNumber}</option>)}
              </select>
            </div>
            {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
            {notice ? <p role="status" className="text-sm text-emerald-800">{notice}</p> : null}
            <button type="submit" disabled={isSaving} className="w-full rounded-md bg-emerald-800 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">{isSaving ? 'Registering…' : 'Register student'}</button>
          </form>

          <section className="portal-panel overflow-hidden">
            <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Institution records</p><h2 className="mt-1 text-lg font-bold">Registered students</h2></div>
              <span className="text-sm font-semibold text-emerald-800">{isLoading ? 'Loading…' : `${students.length} students`}</span>
            </header>
            {isLoading ? <p className="px-5 py-10 text-center text-sm text-slate-500">Loading students…</p> : null}
            {!isLoading && !error && students.length === 0 ? <p className="px-5 py-10 text-center text-sm text-slate-500">No students registered yet.</p> : null}
            {students.length ? (
              <ul className="divide-y divide-slate-200">
                {students.map((student) => (
                  <li key={student.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                    <div><h3 className="font-semibold">{student.name}</h3><p className="text-sm text-slate-500">{student.studentId}</p><p className="text-sm text-slate-500">{student.roomName ? `${student.roomName} · Bed ${student.bedNumber}` : 'No room assigned'}</p><p className="text-sm text-slate-500">Joined {student.joinedDate}</p></div>
                    <div>
                      <p className="text-sm">{student.parentName}</p>
                      <p className="text-sm text-slate-500">{student.parentPhone}</p>
                      <label className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                        <input type="checkbox" checked={student.whatsappRemindersOptedIn} disabled={!student.parentPhone} onChange={() => void updateReminderConsent(student, 'whatsappRemindersOptedIn')} className="accent-emerald-800" />
                        Fee reminders opted in
                      </label>
                      <label className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                        <input type="checkbox" checked={student.whatsappAlertsOptedIn} disabled={!student.parentPhone} onChange={() => void updateReminderConsent(student, 'whatsappAlertsOptedIn')} className="accent-emerald-800" />
                        Safety alerts opted in
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(student.monthlyFee)} / month</span>
                      <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${student.currentStatus === 'INSIDE' ? 'bg-emerald-100 text-emerald-900' : 'bg-orange-100 text-orange-900'}`}>{student.currentStatus}</span>
                      {student.currentStatus === 'OUTSIDE' ? <span className="text-xs font-medium text-slate-500">{formatOutsideDuration(student.statusSince)}</span> : null}
                      <button type="button" onClick={() => void updateStudentStatus(student)} className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                        Mark {student.currentStatus === 'INSIDE' ? 'outside' : 'inside'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
