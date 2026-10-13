# ParentPulse

ParentPulse is a multi-tenant hostel operations prototype built with Next.js App Router, TypeScript, Tailwind CSS, Prisma, and PostgreSQL.

## Local development

Requires Node.js 20.9 or later.

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

For local WhatsApp delivery, configure the Cloud API values in `.env.development.local`, apply pending Prisma migrations to the local database, then run `npm run reminders:run` in a separate terminal. Keep it running; it checks once per minute. Fee reminders go out every other day after the join-date deadline until paid, only to opted-in guardians. Presence alerts go to active WARDEN accounts with phone numbers (or `WHATSAPP_WARDEN_PHONE`) after a student has been outside for more than two hours; opted-in parents are alerted after more than four hours. The Payment status panel shows whether the worker is running. Approve these Meta templates: `${WHATSAPP_TEMPLATE_PREFIX}_fee_reminder`, `${WHATSAPP_TEMPLATE_PREFIX}_student_absence_warden_2h`, and `${WHATSAPP_TEMPLATE_PREFIX}_student_absence_parent_4h`; each template needs three body variables for student name, ID, and elapsed hours (the fee template uses name, billing month, and balance). Phone numbers must include their country code. This worker is local only and is not deployed or started by `npm run dev`.

## Screens

- `/` — ParentPulse welcome page, institution/parent portal choices, product overview, and live demo client count.
- `/platform-login` and `/platform` — ParentPulse platform-owner sign-in and institution provisioning, including floors, rooms, and bed setup.
- `/institution-login` and `/admin` — institution staff sign-in and administration. Platform-owner credentials are rejected here.
- `/students` — student registration and room availability.
- `/operations` — simulated eSSL events, gate history, and leave review.
- `/admin` — institution overview, fee ledger, manual collection records, receipts, absence alerts, notification queue, and institution status.
- `/parent` — one mock student's residence status, fee balance, and leave requests.

## Verification

```powershell
npm test -- --run
npm run lint
npm run build
```

The Vitest suite covers tenant scoping, registration, device-event authentication and deduplication, leave review, manual fee entries, receipts, absence thresholds, and notification queue records.

## Data and integration status

The institution login checks active PostgreSQL accounts and uses a signed, HTTP-only session cookie. The platform owner can create institutions and their first admin from `/admin?view=institutions`; the server creates the database records and returns a generated 8-character password once for secure handoff. Passwords must be 8-128 characters and include at least one letter, one number, and one special character. The endpoint revalidates the platform-owner role against the database and rejects cross-origin requests. There is no unauthenticated signup endpoint.

Platform-owner and institution-administrator email addresses must be globally distinct, case-insensitively. The uniqueness migration stops with an actionable error if existing management accounts share an address; assign separate emails before applying it.

Bootstrap the first platform owner from a trusted terminal after configuring `DATABASE_URL`:

```powershell
npm run provision:owner
```

The command asks for the owner's name/email and collects the password without echoing it. Sign in at `/institution-login`, then use the **Institutions** section to create multiple institution/admin credentials. Each new administrator receives a generated 8-character password shown once in the owner's browser session. Share it securely. The separate `npm run provision:institution` command remains available for operator-run provisioning.

Neon Postgres is connected to this project and the initial Prisma migration is applied. Keep `DATABASE_URL` and `SESSION_SECRET` configured as server-side deployment secrets. Do not put database credentials or session secrets in source control, chat, or a client-side environment variable.

The parent portal, student directory, gate/leave operations, and fee ledger remain mock-backed browser workflows. Do not enter real student or parent data. RLS SQL is present but not applied or enforced by the app's data-access layer; no live device, scheduled alert worker, or notification provider is connected. This provisioning work does not make those workflows ready for real student records or a public operational launch.

Device scans are simulated. No eSSL device is connected, and no notifications are dispatched. Fee amounts and receipts are records of collections handled outside ParentPulse; the application does not process or initiate collections. Portal guards and credentials are demo-only client-side checks, not production authentication or a DPDP compliance implementation.
