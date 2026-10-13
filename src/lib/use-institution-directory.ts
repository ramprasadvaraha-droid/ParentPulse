'use client';

import { useEffect, useState } from 'react';

import {
  readInstitutionDirectory,
  seedInstitutions,
  subscribeToInstitutionDirectory,
  type InstitutionRecord,
} from '@/lib/institutions';

export function useInstitutionDirectory() {
  const [institutions, setInstitutions] = useState<InstitutionRecord[]>(seedInstitutions);

  useEffect(() => {
    const refresh = () => setInstitutions(readInstitutionDirectory());
    refresh();
    return subscribeToInstitutionDirectory(refresh);
  }, []);

  return institutions;
}