import { describe, expect, it } from 'vitest';

import type { PrismaClient } from '@/generated/prisma/client';
import { assertTenantMatch, createTenantScopedClient } from '@/lib/tenant';

describe('tenant isolation', () => {
  it('rejects access across institutions', () => {
    expect(() => assertTenantMatch('institution-a', 'institution-b')).toThrow(
      /cross-tenant access denied/i,
    );
    expect(assertTenantMatch('institution-a', 'institution-a')).toBe('institution-a');
  });

  it('applies a tenant context to each transaction', async () => {
    const calls: string[] = [];

    const prisma = {
      async $transaction<T>(
        callback: (tx: { $executeRawUnsafe(sql: string): Promise<string> }) => Promise<T>,
      ) {
        const tx = {
          async $executeRawUnsafe(sql: string) {
            calls.push(sql);
            return sql;
          },
        };

        calls.push('BEGIN');
        const result = await callback(tx);
        calls.push('COMMIT');
        return result;
      },
    } as unknown as PrismaClient;

    const institutionId = '11111111-1111-4111-8111-111111111111';
    const scoped = createTenantScopedClient(prisma, institutionId);

    await scoped.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SELECT * FROM students');
    });

    const tenantScopedSql = calls.find((entry) => entry.includes('app.current_institution_id'));
    expect(tenantScopedSql).toContain("app.current_institution_id");
    expect(tenantScopedSql).toContain(institutionId);
  });
});
