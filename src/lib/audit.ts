import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';

export async function writeAuditLog({
  institutionId,
  userId,
  action,
  entity,
  entityId,
  metadata,
}: {
  institutionId: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.auditLog.create({
    data: {
      institution_id: institutionId,
      user_id: userId ?? null,
      action,
      entity,
      entity_id: entityId ?? null,
      ...(metadata === undefined ? {} : { metadata }),
    },
  });
}
