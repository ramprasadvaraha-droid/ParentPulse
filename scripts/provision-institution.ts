import { hash } from 'bcryptjs';
import { createInterface, emitKeypressEvents } from 'node:readline';
import { z } from 'zod';
import { isValidAccountPassword } from '../src/lib/password-policy';

const inputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9-]{1,19}$/),
  adminName: z.string().trim().min(2).max(120),
  adminEmail: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  timezone: z.string().trim().min(1).default('Asia/Kolkata'),
});

function promptLine(question: string, defaultValue?: string) {
  const input = createInterface({ input: process.stdin, output: process.stdout });
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  return new Promise<string>((resolve) => {
    input.question(`${question}${suffix}: `, (answer) => {
      input.close();
      resolve(answer.trim() || defaultValue || '');
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
    const onKeypress = (character: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === 'c') {
        finish();
        reject(new Error('Provisioning cancelled'));
        return;
      }
      if (key.name === 'return' || key.name === 'enter') {
        finish();
        resolve(value);
        return;
      }
      if (key.name === 'backspace') {
        value = value.slice(0, -1);
        return;
      }
      if (character && /^[\x20-\x7e]+$/.test(character)) value += character;
    };
    const finish = () => {
      process.stdin.off('keypress', onKeypress);
      process.stdin.setRawMode(false);
      process.stdout.write('\n');
    };
    process.stdin.on('keypress', onKeypress);
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Set DATABASE_URL in this terminal before provisioning');
  }

  const { default: prisma } = await import('../src/lib/prisma');
  try {
    await prisma.$queryRaw`SELECT 1`;
  const name = await promptLine('Institution name', process.env.INSTITUTION_NAME ?? 'Svem School');
  const codeDefault = process.env.INSTITUTION_CODE ?? (name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20));
  const code = await promptLine('Institution code', codeDefault);
  const adminName = await promptLine('Administrator full name', process.env.INSTITUTION_ADMIN_NAME);
  const adminEmail = await promptLine('Administrator email', process.env.INSTITUTION_ADMIN_EMAIL);
  const timezone = await promptLine('Institution timezone', process.env.INSTITUTION_TIMEZONE ?? 'Asia/Kolkata');
  const password = await promptHidden('Administrator password');
  const passwordConfirmation = await promptHidden('Confirm administrator password');

  if (password !== passwordConfirmation) {
    throw new Error('Passwords do not match');
  }
  if (!isValidAccountPassword(password)) {
    throw new Error('Password must be 8-128 characters and include a letter, a number, and a special character');
  }

  const parsed = inputSchema.safeParse({ name, code, adminName, adminEmail, timezone });

  if (!parsed.success) {
    throw new Error(`Invalid provisioning input: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`);
  }

  const input = parsed.data;
  if (await prisma.user.findFirst({
    where: { email: input.adminEmail, role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
    select: { id: true },
  })) {
    throw new Error('Choose an institution administrator email different from every other owner/admin account.');
  }

  try {
    new Intl.DateTimeFormat('en', { timeZone: input.timezone });
  } catch {
    throw new Error('INSTITUTION_TIMEZONE must be a valid IANA timezone');
  }

  const passwordHash = await hash(password, 12);

  const account = await prisma.$transaction(async (transaction) => {
    const institution = await transaction.institution.create({
      data: {
        name: input.name,
        code: input.code,
        timezone: input.timezone,
        status: 'ACTIVE',
      },
    });
    const user = await transaction.user.create({
      data: {
        institution_id: institution.id,
        name: input.adminName,
        email: input.adminEmail,
        password_hash: passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    await transaction.auditLog.create({
      data: {
        institution_id: institution.id,
        user_id: user.id,
        action: 'INSTITUTION_PROVISIONED',
        entity: 'institution',
        entity_id: institution.id,
        metadata: { admin_email: user.email },
      },
    });

    return { institution, user };
  });

  console.log('Institution account created. The password was not echoed or saved in this terminal output.');
  console.log(`Institution: ${account.institution.name} (${account.institution.code})`);
  console.log(`Login: ${account.user.email}`);
  console.log('You can now share the password you entered through your chosen secure channel.');
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Institution provisioning failed');
    process.exitCode = 1;
  });