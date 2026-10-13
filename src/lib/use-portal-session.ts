'use client';

import { useSyncExternalStore } from 'react';

import {
  getPortalSessionSnapshot,
  parsePortalSession,
  subscribeToPortalSession,
} from '@/lib/portal-auth';

export function usePortalSession() {
  const rawSession = useSyncExternalStore(
    subscribeToPortalSession,
    getPortalSessionSnapshot,
    () => null,
  );

  return parsePortalSession(rawSession);
}