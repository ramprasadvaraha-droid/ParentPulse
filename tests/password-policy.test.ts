import { describe, expect, it } from 'vitest';

import { generateAccountPassword, isValidAccountPassword } from '@/lib/password-policy';

describe('account password policy', () => {
  it('requires at least eight characters, including letters, digits, and a special character', () => {
    expect(isValidAccountPassword('Abc123!x')).toBe(true);
    expect(isValidAccountPassword('Abc@123456')).toBe(true);
    expect(isValidAccountPassword('Abc12!x')).toBe(false);
    expect(isValidAccountPassword('Abc1234x')).toBe(false);
    expect(isValidAccountPassword('Abcdef!x')).toBe(false);
    expect(isValidAccountPassword(`Abc123!${'x'.repeat(122)}`)).toBe(false);
  });

  it('generates passwords that meet the same policy', () => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      expect(isValidAccountPassword(generateAccountPassword())).toBe(true);
    }
  });
});