import { describe, expect, it } from 'vitest';

import { addInstitution, seedInstitutions } from '@/lib/institutions';

describe('institution client directory', () => {
  it('adds a newly registered institution to the client count', () => {
    const institutions = addInstitution(seedInstitutions, '  Riverside House  ', 'riverside-01');

    expect(institutions).toHaveLength(seedInstitutions.length + 1);
    expect(institutions.at(-1)).toMatchObject({
      name: 'Riverside House',
      code: 'RIVERSIDE-01',
      status: 'TRIAL',
    });
  });

  it('rejects a duplicate institution code', () => {
    expect(() => addInstitution(seedInstitutions, 'Another Hostel', 'hostel-a')).toThrow(
      /already registered/i,
    );
  });

  it('rejects invalid institution codes', () => {
    expect(() => addInstitution(seedInstitutions, 'Riverside House', 'x!')).toThrow(
      /institution code/i,
    );
  });
});