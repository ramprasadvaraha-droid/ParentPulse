'use client';

import { useEffect, useState } from 'react';

import type { LeaveRequest } from '@/lib/device-leave';

const LEAVE_REQUESTS_KEY = 'parentpulse:leave-requests';
const LEAVE_REQUESTS_EVENT = 'parentpulse:leave-requests-changed';

const initialLeaveRequests: LeaveRequest[] = [
  {
    id: 'leave-demo-1',
    institution_id: 'institution-demo',
    student_id: 'student-2',
    student_name: 'Ishaan Patel',
    start_date: '2026-10-16',
    end_date: '2026-10-18',
    reason: 'Family visit',
    status: 'PENDING',
    approved_by: null,
    processed_at: null,
  },
  {
    id: 'leave-demo-2',
    institution_id: 'institution-demo',
    student_id: 'student-3',
    student_name: 'Rohan Iyer',
    start_date: '2026-10-19',
    end_date: '2026-10-20',
    reason: 'Medical appointment',
    status: 'PENDING',
    approved_by: null,
    processed_at: null,
  },
  {
    id: 'leave-demo-3',
    institution_id: 'institution-demo',
    student_id: 'student-5',
    student_name: 'Siddharth Rao',
    start_date: '2026-10-11',
    end_date: '2026-10-12',
    reason: 'Home visit',
    status: 'APPROVED',
    approved_by: 'warden-demo',
    processed_at: '2026-10-10T11:00:00.000Z',
  },
];

function readLeaveRequests() {
  try {
    const raw = window.localStorage.getItem(LEAVE_REQUESTS_KEY);
    if (!raw) return initialLeaveRequests;

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LeaveRequest[]) : initialLeaveRequests;
  } catch {
    return initialLeaveRequests;
  }
}

export function useLeaveRequests(): [LeaveRequest[], (requests: LeaveRequest[]) => void] {
  const [requests, setRequests] = useState(initialLeaveRequests);

  useEffect(() => {
    const synchronize = () => setRequests(readLeaveRequests());
    synchronize();
    window.addEventListener('storage', synchronize);
    window.addEventListener(LEAVE_REQUESTS_EVENT, synchronize);
    return () => {
      window.removeEventListener('storage', synchronize);
      window.removeEventListener(LEAVE_REQUESTS_EVENT, synchronize);
    };
  }, []);

  const saveRequests = (nextRequests: LeaveRequest[]) => {
    try {
      window.localStorage.setItem(LEAVE_REQUESTS_KEY, JSON.stringify(nextRequests));
    } catch {
      // Keep the current tab usable if browser storage is unavailable.
    }
    setRequests(nextRequests);
    window.dispatchEvent(new Event(LEAVE_REQUESTS_EVENT));
  };

  return [requests, saveRequests];
}