import { defineConfig } from 'prisma/config';

const generateOnlyDatabaseUrl =
  process.env.DATABASE_URL ??
    'postgresql://placeholder:placeholder@localhost:5432/parentpulse?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: generateOnlyDatabaseUrl,
  },
});