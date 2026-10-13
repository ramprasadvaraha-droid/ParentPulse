import type { Prisma, PrismaClient } from '@/generated/prisma/client';

export const TENANT_CONTEXT_KEY = 'app.current_institution_id';
const institutionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertTenantMatch(
  requestedInstitutionId: string | null | undefined,
  currentInstitutionId: string | null | undefined,
) {
  if (!requestedInstitutionId || !currentInstitutionId) {
    throw new Error('Missing institution scope');
  }

  if (requestedInstitutionId !== currentInstitutionId) {
    throw new Error('Cross-tenant access denied');
  }

  return currentInstitutionId;
}

export function buildTenantSetSql(institutionId: string) {
  if (!institutionIdPattern.test(institutionId)) {
    throw new Error('Invalid institution scope');
  }

  return `SET LOCAL ${TENANT_CONTEXT_KEY} = '${institutionId}'`;
}

export function createTenantScopedClient(prisma: PrismaClient, institutionId: string) {
  return {
    async $transaction<T>(
      callback: (tx: Prisma.TransactionClient) => Promise<T>,
      options?: {
        maxWait?: number;
        timeout?: number;
        isolationLevel?: Prisma.TransactionIsolationLevel;
      },
    ) {
      return prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(buildTenantSetSql(institutionId));
        return callback(tx);
      }, options);
    },
  };
}
