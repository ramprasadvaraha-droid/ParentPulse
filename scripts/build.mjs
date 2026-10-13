import { execFileSync } from 'node:child_process';

if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_SKIP_MIGRATIONS !== '1') {
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    stdio: 'inherit',
  });
}

execFileSync(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack'], {
  stdio: 'inherit',
});