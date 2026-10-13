'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type FacilityRoom = {
  id: string;
  name: string;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
};

type FacilityFloor = {
  id: string;
  name: string;
  orderIndex: number;
  rooms: FacilityRoom[];
};

type RoomSummary = {
  totalRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
};

type RoomDraft = { name: string; beds: string };

export default function InstitutionFacilitiesManager({
  institutionCode,
  institutionId,
  institutionName,
  editable = false,
  setupHref,
}: {
  institutionCode: string;
  institutionId?: string;
  institutionName?: string;
  editable?: boolean;
  setupHref?: string;
}) {
  const [floors, setFloors] = useState<FacilityFloor[]>([]);
  const [roomSummary, setRoomSummary] = useState<RoomSummary>({ totalRooms: 0, totalBeds: 0, occupiedBeds: 0, availableBeds: 0 });
  const [floorName, setFloorName] = useState('');
  const [roomDrafts, setRoomDrafts] = useState<Record<string, RoomDraft>>({});
  const [isAddingFloor, setIsAddingFloor] = useState(false);
  const [addingRoomFloorId, setAddingRoomFloorId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingFloor, setSavingFloor] = useState(false);
  const [savingRoom, setSavingRoom] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const query = institutionId ? `?institutionId=${encodeURIComponent(institutionId)}` : '';
    fetch(`/api/institution/facilities${query}`, { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Unable to load floors and rooms.');
        if (active) {
          setFloors(result.floors as FacilityFloor[]);
          setRoomSummary(result.summary as RoomSummary);
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load floors and rooms.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, [institutionId]);

  const addFloor = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingFloor(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/institution/facilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'floor', name: floorName, institutionId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to add floor.');
      setFloors((current) => [...current, result.floor as FacilityFloor]);
      setRoomDrafts((current) => ({ ...current, [result.floor.id]: { name: '', beds: '1' } }));
      setFloorName('');
      setIsAddingFloor(false);
      setNotice(`${result.floor.name} added.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to add floor.');
    } finally {
      setSavingFloor(false);
    }
  };

  const addRoom = async (event: React.FormEvent<HTMLFormElement>, floor: FacilityFloor) => {
    event.preventDefault();
    const draft = roomDrafts[floor.id] ?? { name: '', beds: '1' };
    setSavingRoom(floor.id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/institution/facilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'room', floorId: floor.id, name: draft.name, beds: Number(draft.beds), institutionId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to add room.');
      setFloors((current) => current.map((item) => item.id === floor.id
        ? { ...item, rooms: [...item.rooms, result.room as FacilityRoom] }
        : item));
      setRoomSummary((current) => ({
        ...current,
        totalRooms: current.totalRooms + 1,
        totalBeds: current.totalBeds + result.room.totalBeds,
        availableBeds: current.availableBeds + result.room.totalBeds,
      }));
      setRoomDrafts((current) => ({ ...current, [floor.id]: { name: '', beds: '1' } }));
      setAddingRoomFloorId(null);
      setNotice(`Room ${result.room.name} added to ${floor.name}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to add room.');
    } finally {
      setSavingRoom(null);
    }
  };

  return (
    <main className="portal-workspace min-h-screen px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="portal-panel flex flex-wrap items-end justify-between gap-4 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{institutionCode}</p>
            <h1 className="mt-2 text-2xl font-bold">{institutionName ? `${institutionName} · Floors & rooms` : 'Floors & rooms'}</h1>
          </div>
          {editable ? (
            <Link href="/students" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Rooms</Link>
          ) : setupHref ? (
            <Link href={setupHref} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Manage layout</Link>
          ) : (
            <Link href={institutionId ? '/platform' : '/admin'} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">{institutionId ? 'Institution directory' : 'Dashboard'}</Link>
          )}
        </header>

        <section aria-label="Room and bed summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Total rooms', roomSummary.totalRooms, 'All configured rooms'],
            ['Total beds', roomSummary.totalBeds, 'Beds across all rooms'],
            ['Occupied beds', roomSummary.occupiedBeds, 'Beds assigned to students'],
            ['Available beds', roomSummary.availableBeds, 'Unassigned beds'],
          ].map(([label, count, detail]) => (
            <article key={label} className="portal-panel p-5">
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">{count}</p>
              <p className="mt-1 text-xs text-slate-500">{detail}</p>
            </article>
          ))}
        </section>

        <section aria-label="Floors" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Floors</h2>
            {editable ? <button type="button" onClick={() => setIsAddingFloor((current) => !current)} className="rounded-md border border-emerald-800 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">{isAddingFloor ? 'Cancel' : 'Add floor'}</button> : null}
          </div>
          {editable && isAddingFloor ? (
            <form onSubmit={addFloor} className="portal-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="new-floor-name" className="mb-2 block text-sm font-semibold">Floor name</label>
                <input id="new-floor-name" required minLength={2} maxLength={80} value={floorName} onChange={(event) => setFloorName(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2.5" placeholder={`Floor ${floors.length + 1}`} />
              </div>
              <button type="submit" disabled={savingFloor} className="rounded-md bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">{savingFloor ? 'Adding…' : 'Save floor'}</button>
            </form>
          ) : null}
        </section>

        {notice ? <p role="status" className="border-l-4 border-emerald-700 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">{notice}</p> : null}
        {error ? <p role="alert" className="border-l-4 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p> : null}
        {isLoading ? <p className="py-10 text-center text-sm text-slate-500">Loading floors…</p> : null}
        {!isLoading && floors.length === 0 ? <p className="portal-panel px-5 py-10 text-center text-sm text-slate-500">Add the first floor to start arranging rooms.</p> : null}

        <div className="space-y-5">
          {floors.map((floor) => {
            const draft = roomDrafts[floor.id] ?? { name: '', beds: '1' };
            return (
              <section key={floor.id} className="portal-panel overflow-hidden">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                  <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Floor {floor.orderIndex}</p><h2 className="mt-1 text-lg font-bold">{floor.name}</h2></div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500">{floor.rooms.length} rooms</span>
                    {editable ? <button type="button" onClick={() => setAddingRoomFloorId((current) => current === floor.id ? null : floor.id)} className="rounded-md border border-emerald-800 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">{addingRoomFloorId === floor.id ? 'Cancel' : 'Add room'}</button> : null}
                  </div>
                </header>
                {editable && addingRoomFloorId === floor.id ? <form onSubmit={(event) => addRoom(event, floor)} className="grid gap-3 border-b border-slate-200 p-5 sm:grid-cols-[1fr_140px_auto] sm:items-end">
                  <div>
                    <label htmlFor={`room-name-${floor.id}`} className="mb-2 block text-sm font-semibold">Room name</label>
                    <input id={`room-name-${floor.id}`} required maxLength={40} value={draft.name} onChange={(event) => setRoomDrafts((current) => ({ ...current, [floor.id]: { ...draft, name: event.target.value } }))} className="w-full rounded-md border border-slate-300 px-3 py-2.5" placeholder="A-101" />
                  </div>
                  <div>
                    <label htmlFor={`room-beds-${floor.id}`} className="mb-2 block text-sm font-semibold">Beds</label>
                    <select id={`room-beds-${floor.id}`} value={draft.beds} onChange={(event) => setRoomDrafts((current) => ({ ...current, [floor.id]: { ...draft, beds: event.target.value } }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5">
                      {[1, 2, 3, 4].map((beds) => <option key={beds} value={beds}>{beds} {beds === 1 ? 'bed' : 'beds'}</option>)}
                    </select>
                  </div>
                  <button type="submit" disabled={savingRoom === floor.id} className="rounded-md border border-emerald-800 px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-60">{savingRoom === floor.id ? 'Adding…' : 'Save room'}</button>
                </form> : null}
                {floor.rooms.length ? (
                  <ul className="divide-y divide-slate-200">
                    {floor.rooms.map((room) => (
                      <li key={room.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                        <div><h3 className="font-semibold">{room.name}</h3><p className="text-sm text-slate-500">{room.occupiedBeds} occupied · {room.availableBeds} available</p></div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{room.totalBeds} {room.totalBeds === 1 ? 'bed' : 'beds'}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="px-5 py-6 text-sm text-slate-500">No rooms on this floor yet.</p>}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
