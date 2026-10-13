import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to seed the database');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function main() {
  const institutionAId = randomUUID();
  const institutionBId = randomUUID();

  const hostelA = await prisma.institution.upsert({
    where: { code: 'HOSTEL-A' },
    update: {},
    create: {
      id: institutionAId,
      name: 'Greenwood Boys Hostel',
      code: 'HOSTEL-A',
      timezone: 'Asia/Kolkata',
      country: 'India',
      status: 'ACTIVE',
    },
  });

  const hostelB = await prisma.institution.upsert({
    where: { code: 'HOSTEL-B' },
    update: {},
    create: {
      id: institutionBId,
      name: 'Northview Girls Hostel',
      code: 'HOSTEL-B',
      timezone: 'Asia/Kolkata',
      country: 'India',
      status: 'ACTIVE',
    },
  });

  const passwordHash = await hash('Password123!', 10);

  const roles = [
    { institutionId: hostelA.id, name: 'Asha Admin', email: 'admin@hostel-a.example', role: 'ADMIN' },
    { institutionId: hostelA.id, name: 'Ravi Warden', email: 'warden@hostel-a.example', role: 'WARDEN' },
    { institutionId: hostelA.id, name: 'Mehul Accountant', email: 'accountant@hostel-a.example', role: 'ACCOUNTANT' },
    { institutionId: hostelA.id, name: 'Amit Parent', email: 'parent-a@hostel-a.example', role: 'PARENT' },
    { institutionId: hostelA.id, name: 'Platform Owner', email: 'platform@parentpulse.example', role: 'SUPER_ADMIN' },
    { institutionId: hostelB.id, name: 'Naina Admin', email: 'admin@hostel-b.example', role: 'ADMIN' },
    { institutionId: hostelB.id, name: 'Deepak Warden', email: 'warden@hostel-b.example', role: 'WARDEN' },
    { institutionId: hostelB.id, name: 'Sana Accountant', email: 'accountant@hostel-b.example', role: 'ACCOUNTANT' },
    { institutionId: hostelB.id, name: 'Rina Parent', email: 'parent-b@hostel-b.example', role: 'PARENT' },
    { institutionId: hostelB.id, name: 'Platform Owner 2', email: 'platform2@parentpulse.example', role: 'SUPER_ADMIN' },
  ] as const;

  for (const role of roles) {
    await prisma.user.upsert({
      where: {
        institution_id_email: {
          institution_id: role.institutionId,
          email: role.email,
        },
      },
      update: {},
      create: {
        id: randomUUID(),
        institution_id: role.institutionId,
        name: role.name,
        email: role.email,
        password_hash: passwordHash,
        role: role.role,
        status: 'ACTIVE',
      },
    });
  }

  const parentA = await prisma.parent.upsert({
    where: {
      institution_id_whatsapp_number: {
        institution_id: hostelA.id,
        whatsapp_number: '+919900000001',
      },
    },
    update: {},
    create: {
      id: randomUUID(),
      institution_id: hostelA.id,
      name: 'Amit Parent',
      whatsapp_number: '+919900000001',
      email: 'parent-a@hostel-a.example',
    },
  });

  const parentB = await prisma.parent.upsert({
    where: {
      institution_id_whatsapp_number: {
        institution_id: hostelB.id,
        whatsapp_number: '+919900000002',
      },
    },
    update: {},
    create: {
      id: randomUUID(),
      institution_id: hostelB.id,
      name: 'Rina Parent',
      whatsapp_number: '+919900000002',
      email: 'parent-b@hostel-b.example',
    },
  });

  const blockA = await prisma.block.create({
    data: {
      id: randomUUID(),
      institution_id: hostelA.id,
      name: 'Block A',
      description: 'Main block',
    },
  });

  const blockB = await prisma.block.create({
    data: {
      id: randomUUID(),
      institution_id: hostelB.id,
      name: 'Block B',
      description: 'Annex block',
    },
  });

  const roomA = await prisma.room.create({
    data: {
      id: randomUUID(),
      institution_id: hostelA.id,
      block_id: blockA.id,
      name: 'A-101',
      floor: 1,
      total_beds: 4,
    },
  });

  const roomB = await prisma.room.create({
    data: {
      id: randomUUID(),
      institution_id: hostelB.id,
      block_id: blockB.id,
      name: 'B-201',
      floor: 2,
      total_beds: 3,
    },
  });

  await prisma.student.upsert({
    where: {
      institution_id_essl_id: {
        institution_id: hostelA.id,
        essl_id: 'ESSL-1001',
      },
    },
    update: {},
    create: {
      id: randomUUID(),
      institution_id: hostelA.id,
      parent_id: parentA.id,
      room_id: roomA.id,
      essl_id: 'ESSL-1001',
      name: 'Aarav Sharma',
      joined_date: new Date('2024-08-14T00:00:00.000Z'),
      monthly_fee: 4500,
      status: 'ACTIVE',
      current_status: 'INSIDE',
    },
  });

  await prisma.student.upsert({
    where: {
      institution_id_essl_id: {
        institution_id: hostelB.id,
        essl_id: 'ESSL-2001',
      },
    },
    update: {},
    create: {
      id: randomUUID(),
      institution_id: hostelB.id,
      parent_id: parentB.id,
      room_id: roomB.id,
      essl_id: 'ESSL-2001',
      name: 'Diya Reddy',
      joined_date: new Date('2024-07-20T00:00:00.000Z'),
      monthly_fee: 5000,
      status: 'ACTIVE',
      current_status: 'INSIDE',
    },
  });

  await prisma.institutionSetting.createMany({
    data: [
      {
        id: randomUUID(),
        institution_id: hostelA.id,
        key: 'alert_thresholds',
        value: { wardenMinutes: 120, parentMinutes: 240 },
      },
      {
        id: randomUUID(),
        institution_id: hostelA.id,
        key: 'device_offline_threshold_minutes',
        value: 15,
      },
      {
        id: randomUUID(),
        institution_id: hostelB.id,
        key: 'alert_thresholds',
        value: { wardenMinutes: 120, parentMinutes: 240 },
      },
      {
        id: randomUUID(),
        institution_id: hostelB.id,
        key: 'device_offline_threshold_minutes',
        value: 15,
      },
    ],
  });

  await prisma.auditLog.create({
    data: {
      id: randomUUID(),
      institution_id: hostelA.id,
      action: 'SEED_DATA',
      entity: 'institution',
      entity_id: hostelA.id,
      metadata: { source: 'prisma/seed.ts' },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Seed failed', error);
    await prisma.$disconnect();
    process.exit(1);
  });
