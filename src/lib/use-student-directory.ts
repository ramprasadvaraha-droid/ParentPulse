'use client';

import { useEffect, useState } from 'react';

import { mockStudents } from '@/lib/mock-data';
import {
  readStudentDirectory,
  saveStudentDirectory,
  subscribeToStudentDirectory,
} from '@/lib/student-directory';
import type { Student } from '@/lib/student-registry';

export function useStudentDirectory(): [Student[], (students: Student[]) => void] {
  const [students, setStudents] = useState<Student[]>(mockStudents);

  useEffect(() => {
    const refresh = () => setStudents(readStudentDirectory());
    refresh();
    return subscribeToStudentDirectory(refresh);
  }, []);

  const updateStudents = (nextStudents: Student[]) => {
    saveStudentDirectory(nextStudents);
    setStudents(nextStudents);
  };

  return [students, updateStudents];
}