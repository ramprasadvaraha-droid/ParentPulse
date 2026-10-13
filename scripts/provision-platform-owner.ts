import { createInterface, emitKeypressEvents } from 'node:readline';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { isValidAccountPassword } from '../src/lib/password-policy';

const ownerInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
});

function promptLine(question: string) {
  const input = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<string>((resolve) => {
    input.question(`${question}: `, (answer) => {
      input.close();
      resolve(answer.trim());
    });
  });
}

function promptHidden(question: string) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Run this command in an interactive terminal to enter the password securely');
  }

  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdout.write(`${question}: `);
  return new Promise<string>((resolve, reject) => {
    let value = '';
    const finish = () => {
      process.stdin.off('keypress', onKeypress);
      process.stdin.setRawMode(false);
      process.stdout.write('\n');
    };
    const onKeypress = (character: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === 'c') {
        finish();
        reject(new Error('Provisioning cancelled'));
      } else if (key.name === 'return' || key.name === 'enter') {
        finish();
        resolve(value);
      } else if (key.name === 'backspace') {
        value = value.slice(0, -1);
      } else if (character && /^[\x20-\x7e]+$/.test(character)) {
        value += character;
      }
    };
    process.stdin.on('keypress', onKeypress);
  });
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before provisioning');
  const { default: prisma } = await import('../src/lib/prisma');
  try {
    await prisma.$queryRaw`SELECT 1`;
    if (await prisma.user.count({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE' } })) {
      throw new Error('An active platform owner already exists');
    }

    const parsed = ownerInputSchema.safeParse({
      name: await promptLine('Platform owner name'),
      email: await promptLine('Platform owner email'),
    });
    if (!parsed.success) throw new Error('Enter a valid owner name and email');
    if (await prisma.user.findFirst({
      where: { email: parsed.data.email, role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      select: { id: true },
    })) {
      throw new Error('Choose an email different from every institution administrator.');
    }

    const password = await promptHidden('Platform owner password');
    const confirmation = await promptHidden('Confirm platform owner password');
    if (password !== confirmation) throw new Error('Passwords do not match');
    if (!isValidAccountPassword(password)) {
      throw new Error('Password must be 8-128 characters and include a letter, a number, and a special character');
    }

    const passwordHash = await hash(password, 12);
    const result = await prisma.$transaction(async (transaction) => {
      const institution = await transaction.institution.upsert({
        where: { code: 'PARENTPULSE' },
        update: { status: 'ACTIVE' },
        create: { name: 'ParentPulse Platform', code: 'PARENTPULSE', status: 'ACTIVE' },
      });
      const owner = await transaction.user.create({
        data: {
          institution_id: institution.id,
          name: parsed.data.name,
          email: parsed.data.email,
          password_hash: passwordHash,
          role: 'SUPER_ADMIN',
          status: 'ACTIVE',
        },
      });
      await transaction.auditLog.create({
        data: {
          institution_id: institution.id,
          user_id: owner.id,
          action: 'PLATFORM_OWNER_PROVISIONED',
          entity: 'user',
          entity_id: owner.id,
          metadata: { email: owner.email },
        },
      });
      return owner;
    });

    console.log('Platform owner created. Password input was hidden and was not saved in output.');
    console.log(`Login: ${result.email}`);
    console.log('Open the institution login page to sign in as the platform owner.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Owner provisioning failed');
  process.exitCode = 1;
});