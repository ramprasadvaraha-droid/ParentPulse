import { mockStudents } from '@/lib/mock-data';
import type { Student } from '@/lib/student-registry';

export const STUDENT_DIRECTORY_KEY = 'parentpulse:students';
export const STUDENT_DIRECTORY_EVENT = 'parentpulse:students-changed';

let cachedRaw: string | null | undefined;
let cachedStudents: Student[] = mockStudents;

export function readStudentDirectory(): Student[] {
  if (typeof window === 'undefined') return mockStudents;

  const raw = window.sessionStorage.getItem(STUDENT_DIRECTORY_KEY);
  if (raw === cachedRaw) return cachedStudents;
  if (!raw) {
    cachedRaw = null;
    cachedStudents = mockStudents;
    return cachedStudents;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.every(
        (student) =>
          typeof student?.id === 'string' &&
          typeof student?.name === 'string' &&
          typeof student?.essl_id === 'string' &&
          typeof student?.parent_mobile === 'string',
      )
    ) {
      cachedRaw = raw;
      cachedStudents = parsed as Student[];
      return cachedStudents;
    }
  } catch {
    window.sessionStorage.removeItem(STUDENT_DIRECTORY_KEY);
  }

  cachedRaw = null;
  cachedStudents = mockStudents;
  return cachedStudents;
}

export function saveStudentDirectory(students: Student[]) {
  if (typeof window === 'undefined') return;

  const raw = JSON.stringify(students);
  window.sessionStorage.setItem(STUDENT_DIRECTORY_KEY, raw);
  cachedRaw = raw;
  cachedStudents = students;
  window.dispatchEvent(new Event(STUDENT_DIRECTORY_EVENT));
}

export function subscribeToStudentDirectory(onChange: () => void) {
  if (typeof window === 'undefined') return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === STUDENT_DIRECTORY_KEY) {
      cachedRaw = undefined;
      onChange();
    }
  };
  const onDirectoryChange = () => onChange();

  window.addEventListener('storage', onStorage);
  window.addEventListener(STUDENT_DIRECTORY_EVENT, onDirectoryChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(STUDENT_DIRECTORY_EVENT, onDirectoryChange);
  };
}