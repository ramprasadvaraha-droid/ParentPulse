export type InstitutionRecord = {
  id: string;
  name: string;
  code: string;
  status: 'ACTIVE' | 'TRIAL';
  plan: string;
  review_date: string;
};

export const INSTITUTION_DIRECTORY_KEY = 'parentpulse:institutions';
export const INSTITUTION_DIRECTORY_EVENT = 'parentpulse:institutions-changed';

export const seedInstitutions: InstitutionRecord[] = [
  {
    id: 'institution-hostel-a',
    name: 'Greenwood Boys Hostel',
    code: 'HOSTEL-A',
    status: 'ACTIVE',
    plan: 'Growth',
    review_date: '2027-01-01',
  },
  {
    id: 'institution-hostel-b',
    name: 'Northview Girls Hostel',
    code: 'HOSTEL-B',
    status: 'TRIAL',
    plan: 'Starter trial',
    review_date: '2026-11-01',
  },
];

export function addInstitution(
  institutions: InstitutionRecord[],
  nameInput: string,
  codeInput: string,
): InstitutionRecord[] {
  const name = nameInput.trim();
  const code = codeInput.trim().replace(/\s+/g, '-').toUpperCase();

  if (name.length < 2) {
    throw new Error('Enter an institution name');
  }
  if (!/^[A-Z0-9][A-Z0-9-]{1,19}$/.test(code)) {
    throw new Error('Use 2-20 letters, numbers, or hyphens for the institution code');
  }
  if (institutions.some((institution) => institution.code.toUpperCase() === code)) {
    throw new Error('An institution with this code is already registered');
  }

  const reviewDate = new Date();
  reviewDate.setDate(reviewDate.getDate() + 30);

  return [
    ...institutions,
    {
      id: `institution-${code.toLowerCase()}`,
      name,
      code,
      status: 'TRIAL',
      plan: 'Starter trial',
      review_date: reviewDate.toISOString().slice(0, 10),
    },
  ];
}

export function readInstitutionDirectory(): InstitutionRecord[] {
  if (typeof window === 'undefined') {
    return seedInstitutions;
  }

  const stored = window.localStorage.getItem(INSTITUTION_DIRECTORY_KEY);
  if (!stored) {
    window.localStorage.setItem(INSTITUTION_DIRECTORY_KEY, JSON.stringify(seedInstitutions));
    return seedInstitutions;
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    if (
      Array.isArray(parsed) &&
      parsed.every(
        (institution) =>
          typeof institution?.id === 'string' &&
          typeof institution?.name === 'string' &&
          typeof institution?.code === 'string' &&
          typeof institution?.status === 'string' &&
          typeof institution?.plan === 'string' &&
          typeof institution?.review_date === 'string',
      )
    ) {
      return parsed as InstitutionRecord[];
    }
  } catch {
    window.localStorage.removeItem(INSTITUTION_DIRECTORY_KEY);
  }

  window.localStorage.setItem(INSTITUTION_DIRECTORY_KEY, JSON.stringify(seedInstitutions));
  return seedInstitutions;
}

export function registerInstitution(name: string, code: string) {
  const institutions = addInstitution(readInstitutionDirectory(), name, code);
  window.localStorage.setItem(INSTITUTION_DIRECTORY_KEY, JSON.stringify(institutions));
  window.dispatchEvent(new Event(INSTITUTION_DIRECTORY_EVENT));
  return institutions;
}

export function subscribeToInstitutionDirectory(onChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === INSTITUTION_DIRECTORY_KEY) onChange();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(INSTITUTION_DIRECTORY_EVENT, onChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(INSTITUTION_DIRECTORY_EVENT, onChange);
  };
}