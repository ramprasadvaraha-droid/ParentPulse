'use client';

import { useEffect, useState } from 'react';

import type { GateEvent } from '@/lib/device-leave';

const GATE_EVENTS_KEY = 'parentpulse:gate-events';
const GATE_EVENTS_EVENT = 'parentpulse:gate-events-changed';

export const initialGateEvents: GateEvent[] = [
  {
    id: 'gate-demo-1',
    institution_id: 'institution-demo',
    device_id: 'device-demo-01',
    student_id: 'student-2',
    essl_id: 'ESSL-1002',
    punch_time: '2026-10-12T09:40:00.000Z',
    direction: 'IN',
    is_authorized: true,
  },
  {
    id: 'gate-demo-2',
    institution_id: 'institution-demo',
    device_id: 'device-demo-01',
    student_id: 'student-1',
    essl_id: 'ESSL-1001',
    punch_time: '2026-10-12T09:28:00.000Z',
    direction: 'OUT',
    is_authorized: true,
  },
  {
    id: 'gate-demo-3',
    institution_id: 'institution-demo',
    device_id: 'device-demo-01',
    student_id: 'student-3',
    essl_id: 'ESSL-1003',
    punch_time: '2026-10-12T09:10:00.000Z',
    direction: 'IN',
    is_authorized: true,
  },
  {
    id: 'gate-alert-demo-2',
    institution_id: 'institution-demo',
    device_id: 'device-demo-01',
    student_id: 'student-2',
    essl_id: 'ESSL-1002',
    punch_time: '2026-10-12T11:30:00.000Z',
    direction: 'OUT',
    is_authorized: true,
  },
];

function readGateEvents() {
  try {
    const raw = window.localStorage.getItem(GATE_EVENTS_KEY);
    if (!raw) return initialGateEvents;

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GateEvent[]) : initialGateEvents;
  } catch {
    return initialGateEvents;
  }
}

export function useGateEvents(): [GateEvent[], (events: GateEvent[]) => void] {
  const [events, setEvents] = useState(initialGateEvents);

  useEffect(() => {
    const synchronize = () => setEvents(readGateEvents());
    synchronize();
    window.addEventListener('storage', synchronize);
    window.addEventListener(GATE_EVENTS_EVENT, synchronize);
    return () => {
      window.removeEventListener('storage', synchronize);
      window.removeEventListener(GATE_EVENTS_EVENT, synchronize);
    };
  }, []);

  const saveEvents = (nextEvents: GateEvent[]) => {
    try {
      window.localStorage.setItem(GATE_EVENTS_KEY, JSON.stringify(nextEvents));
    } catch {
      // Keep the current tab usable if browser storage is unavailable.
    }
    setEvents(nextEvents);
    window.dispatchEvent(new Event(GATE_EVENTS_EVENT));
  };

  return [events, saveEvents];
}