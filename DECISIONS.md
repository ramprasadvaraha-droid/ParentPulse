# Phase 0 Decisions

## 1) Stack and platform choices
- Next.js 16 App Router with TypeScript and Tailwind CSS.
- `shadcn/ui` for the design system shell, `Framer Motion` for transitions, and `Lucide` for iconography.
- `Recharts`, `dnd-kit`, `TanStack Query`, `Zod`, and `Prisma` are included as required.
- Supabase or Neon Postgres is the database target; Prisma is the ORM layer.
- Form and API validation use `Zod`, and server-side logic stays in Next.js route handlers.
- WhatsApp is abstracted behind a provider interface with a Cloud API adapter; we keep the message templates in a central config.
- Vercel hosts the app; Supabase/Neon hosts the database; jobs run via Supabase `pg_cron` or Inngest.
- UTC is stored in the database, and the app displays Asia/Kolkata in UI and reporting.

## 2) Folder structure
- `app/` — route-level layout, pages, and server components.
- `app/api/` — REST route handlers and webhook endpoints.
- `components/` — reusable UI blocks, shadcn wrappers, and dashboard widgets.
- `components/ui/` — shadcn-generated primitives.
- `components/features/` — domain-specific screens and forms.
- `lib/` — shared utilities, Prisma client, tenancy enforcement, auth helpers, and server actions.
- `prisma/` — schema, migrations, seed, and RLS SQL.
- `tests/` — regression tests for tenant isolation and acceptance checks.
- `types/` — shared TypeScript types and DTO definitions.
- `scripts/` — operational utilities (seed, export, maintenance).
- `public/` — static assets and manifest placeholders.

## 3) Environment variables
```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
NEXTAUTH_SECRET="..."
SESSION_SECRET="..."
APP_URL="http://localhost:3000"
TZ="Asia/Kolkata"
WHATSAPP_API_KEY="..."
WHATSAPP_SENDER_ID="..."
WHATSAPP_TEMPLATE_PREFIX="parentpulse"
SUPABASE_URL="..."
SUPABASE_SERVICE_ROLE_KEY="..."
INNGEST_EVENT_KEY="..."
INNGEST_SIGNING_KEY="..."
```

## 4) Naming conventions
- `camelCase` for local variables and function names.
- `PascalCase` for React components, enums, and model types.
- `snake_case` for database column names and SQL identifiers.
- `kebab-case` for route segments and static file names.
- `institution_id` is required on every tenant table and used for all row-scoped access.
- `created_at` and `updated_at` are included on every model.
- Use UUID primary keys and uppercase Prisma enums for statuses and roles.

## 5) Core product assumptions
- The platform is never a payment processor. It records fee collection manually.
- RLS is the security boundary, and the app must always pass the institution scope explicitly.
- Device authentication uses a serial + secret hash for eSSL webhook validation.
- We will use a mock seed data set that can run without the production backend.
- Alerts, leave flows, and devices are driven by the `institution_settings` table and tenant-scoped defaults.
