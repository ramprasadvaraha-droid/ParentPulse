'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { mockRooms } from '@/lib/mock-data';
import InstitutionFacilitiesManager from './InstitutionFacilitiesManager';
import { useStudentDirectory } from '@/lib/use-student-directory';
import {
  calculateProrationFlag,
  createStudentRegistration,
  getRoomAvailability,
} from '@/lib/student-registry';
import { usePortalSession } from '@/lib/use-portal-session';

const defaultForm = {
  name: '',
  essl_id: '',
  parent_name: '',
  parent_mobile: '',
  alternate_mobile: '',
  room_id: mockRooms[0]?.id ?? '',
  joined_date: '2026-10-12',
  monthly_fee: '4200',
};

export default function StudentRegistrationDashboard() {
  const session = usePortalSession();
  const [students, setStudents] = useStudentDirectory();
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const prorationFlag = useMemo(
    () => calculateProrationFlag(form.joined_date),
    [form.joined_date],
  );

  if (session?.institutionCode !== 'HOSTEL-A') {
    return <InstitutionFacilitiesManager institutionCode={session?.institutionCode ?? 'Institution'} setupHref="/students/facilities" />;
  }

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selectedRoom = mockRooms.find((room) => room.id === form.room_id);

    if (!selectedRoom) {
      setError('Please select a valid room');
      return;
    }

    try {
      const { student } = createStudentRegistration(students, selectedRoom, {
        name: form.name,
        essl_id: form.essl_id,
        parent_name: form.parent_name,
        parent_mobile: form.parent_mobile,
        alternate_mobile: form.alternate_mobile,
        room_id: form.room_id,
        joined_date: form.joined_date,
        monthly_fee: Number(form.monthly_fee),
      });

      setStudents([...students, student]);
      setError(null);
      setSuccess(
        `${student.name} registered successfully. ${student.proration ? 'Proration applies for a mid-month join.' : 'Standard billing date applied.'}`,
      );
      setForm({
        ...defaultForm,
        room_id: selectedRoom.id,
      });
    } catch (submissionError) {
      setSuccess(null);
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Unable to complete student registration.',
      );
    }
  };

  return (
    <main className="portal-workspace min-h-screen px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="portal-panel flex flex-col gap-3 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/" className="text-sm font-semibold text-emerald-800 hover:underline">
              ParentPulse
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Student registration</h1>
            <p className="mt-1 text-sm text-slate-500">Hostel room matrix</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
              {students.length} active students / {mockRooms.reduce((total, room) => total + room.total_beds, 0)} beds
            </span>
            <Link href="/operations" className="rounded-md bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-900">Gate & leave</Link>
            <Link href="/admin" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Administration</Link>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_1.6fr]">
          <form id="students" onSubmit={handleSubmit} className="portal-panel space-y-5 p-6">
            <p className="border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">Demo prototype: use synthetic student and mobile details only. Records are stored in this browser and are not production-secured.</p>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="student-name">Student name</label>
              <input id="student-name" name="name" value={form.name} onChange={handleChange} className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-emerald-700 focus:bg-white" placeholder="Enter full name" required />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="student-essl">Student ID (eSSL)</label>
              <input id="student-essl" name="essl_id" value={form.essl_id} onChange={handleChange} className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-emerald-700 focus:bg-white" placeholder="ESSL-1009" required />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="parent-name">Parent / guardian</label>
              <input id="parent-name" name="parent_name" value={form.parent_name} onChange={handleChange} className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-emerald-700 focus:bg-white" placeholder="Parent name" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="parent-mobile">Parent mobile number</label>
                <input id="parent-mobile" type="tel" name="parent_mobile" value={form.parent_mobile} onChange={handleChange} autoComplete="tel" inputMode="tel" className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-emerald-700 focus:bg-white" placeholder="+91 90000 00000" required />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="alternate-mobile">Alternate mobile number</label>
                <input id="alternate-mobile" type="tel" name="alternate_mobile" value={form.alternate_mobile} onChange={handleChange} autoComplete="tel-national" inputMode="tel" className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-emerald-700 focus:bg-white" placeholder="Optional" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="joined-date">Joined date</label>
                <input id="joined-date" type="date" name="joined_date" value={form.joined_date} onChange={handleChange} className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-emerald-700 focus:bg-white" required />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="monthly-fee">Monthly fee</label>
                <input id="monthly-fee" type="number" name="monthly_fee" value={form.monthly_fee} onChange={handleChange} min="0" step="50" className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-emerald-700 focus:bg-white" required />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="room-selection">Room selection</label>
              <select id="room-selection" name="room_id" value={form.room_id} onChange={handleChange} className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-emerald-700 focus:bg-white">
                {mockRooms.map((room) => {
                  const available = getRoomAvailability(room, students);
                  return <option key={room.id} value={room.id} disabled={available <= 0}>{room.name} — {available} beds left</option>;
                })}
              </select>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {prorationFlag ? 'Mid-month joiner detected: fee proration is required.' : 'Full-month billing applies for this join date.'}
            </div>
            {error ? <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            {success ? <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}
            <button type="submit" className="w-full rounded-md bg-emerald-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900">Register student</button>
          </form>

          <section id="rooms" className="portal-panel p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-slate-900">Room availability</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{mockRooms.filter((room) => getRoomAvailability(room, students) > 0).length} rooms open</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {mockRooms.map((room) => {
                const available = getRoomAvailability(room, students);
                const full = available <= 0;
                return (
                  <button key={room.id} type="button" disabled={full} onClick={() => setForm((current) => ({ ...current, room_id: room.id }))} className={`rounded-lg border p-4 text-left transition ${full ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400' : form.room_id === room.id ? 'border-emerald-700 bg-emerald-50 text-emerald-950 shadow-sm' : 'border-slate-200 bg-white text-slate-800 hover:border-emerald-300 hover:bg-emerald-50'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold">{room.name}</span>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${full ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>{full ? 'Full' : 'Open'}</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-500">{room.block}</p>
                    <div className="mt-6 flex items-end justify-between">
                      <div><p className="text-xs uppercase tracking-wide text-slate-500">Available</p><p className="text-2xl font-bold">{available}</p></div>
                      <div className="text-right text-xs text-slate-500"><div>Total beds</div><div className="font-semibold text-slate-700">{room.total_beds}</div></div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}