# ParentPulse Product Requirements Document

**Status:** Draft  
**Version:** 1.0  
**Updated:** 2026-10-13  
**Product:** ParentPulse multi-tenant hostel operations platform

## 1. Product Summary

ParentPulse helps hostel operators manage institution access, student and guardian records, room capacity, student presence, leave workflows, and manually recorded fees. ParentPulse provisions each institution and its administrator. Platform owners use a separate platform workspace; they do not sign in through an institution staff portal.

The product is a prototype with selected database-backed workflows. Device scans, parent access, and some operations remain simulated. WhatsApp delivery requires external Meta configuration and a running worker. The current product must not be represented as DPDP Act-compliant or ready for unrestricted real-person data until the security and operational gaps in this document are addressed.

## 2. Problem and Opportunity

Hostel operators often coordinate student records, room assignments, gate movements, leave approvals, and fee balances across disconnected processes. Families may not receive timely updates when a student remains outside the hostel. ParentPulse aims to give authorized staff one institution-scoped workspace and provide a controlled path for family notifications.

## 3. Goals

- Give ParentPulse owners a distinct workspace to provision institution access and configure institution floors, rooms, and beds.
- Give institution administrators a separate sign-in and workspace limited to their institution.
- Maintain a current student directory, guardian contact details, room assignment, fee, and inside/outside status.
- Support safe, auditable absence and fee reminders when notification providers are configured and recipients have opted in.
- Keep fee recording informational: ParentPulse does not collect, transfer, or process money.

## 4. Non-Goals

- Processing payments or acting as a payment gateway.
- Replacing an electronic access-control or eSSL device before a production device integration exists.
- Claiming legal compliance certification or providing legal advice.
- Sending WhatsApp messages without the recipient consent, approved Meta templates, valid credentials, and an operational worker.
- Treating demo credentials, mock records, or browser-only guards as production authentication.

## 5. Users and Access Model

### ParentPulse platform owner

- Signs in at `/platform-login` and works in `/platform`.
- Provisions institutions and their first administrator credentials.
- Configures floors, rooms, and beds for an institution.
- Uses a unique email distinct from all institution-administrator accounts.
- Must not use the institution staff portal.

### Institution administrator

- Signs in at `/institution-login` and uses `/admin` and institution workflows.
- Manages only the institution associated with their account.
- Uses a unique email distinct from platform owners and other institution administrators.
- Receives credentials from ParentPulse; there is no public self-registration.

### Warden / staff

- Receives operational assignments through an active institution account.
- Warden phone numbers may be used as recipients for configured presence alerts.
- A separate least-privilege staff login and role-specific authorization model is required before production rollout.

### Parent or guardian

- Provides contact details during student registration.
- May opt in separately to fee reminders and safety alerts.
- Parent portal access is currently demo-backed and requires production identity verification before real use.

## 6. Core Workflows

1. **Provision an institution:** platform owner creates institution name/code and first administrator; temporary password is shown once for secure handoff.
2. **Configure facilities:** platform owner selects an institution and adds floors, rooms, and bed counts. Institution-scoped administrators may manage only their own facilities where authorized.
3. **Register a student:** staff enters student ID/name, guardian contact, join date, monthly fee, room, and bed. Guardian consent for fee reminders and safety alerts is captured separately.
4. **Track presence:** staff views inside/outside counts and each student's status duration. Status can be manually updated until a live gate-device integration is available.
5. **Handle fees:** staff reviews current fee balances and records externally received payments. ParentPulse issues a record/receipt but does not move funds.
6. **Notify recipients:** when configured, the worker evaluates overdue balances and outside duration, sends only approved WhatsApp templates to eligible opted-in recipients, and logs results.

## 7. Functional Requirements

### Owner and institution access

- **FR-01:** Platform-owner and institution sign-in flows are separate. A `SUPER_ADMIN` credential must not create an institution-portal session.
- **FR-02:** Institution sign-in accepts active institution administrators only.
- **FR-03:** Platform owners can create an institution and its initial administrator, then see institution status and administrator email.
- **FR-04:** Administrator credentials are generated securely and displayed only once after provisioning.
- **FR-05:** Platform-owner and institution-administrator emails are globally unique, case-insensitively. Creation must return a clear conflict if an email is already assigned.
- **FR-06:** The database migration enforcing email uniqueness must stop without changing accounts if pre-existing duplicate management emails are found. An operator must resolve duplicates explicitly.
- **FR-07:** Every institution-owned read/write must be scoped to the signed-in institution. Platform-owner access to an institution must require explicit institution selection.

### Facilities and student records

- **FR-08:** Platform owners can add floors, rooms, and 1-4 beds per room for a selected institution.
- **FR-09:** Student registration captures student identifier, name, guardian name/phone, join date, monthly fee, floor/room/bed, and separate notification consents.
- **FR-10:** The student dashboard displays total residents, inside count, outside count, current status, and elapsed time outside.
- **FR-11:** Presence updates refresh while the dashboard is open. Until a device integration is complete, authorized staff can update status manually; the UI must not imply status is coming from a live device.
- **FR-12:** A bed cannot be assigned to more than one active student within its institution.

### Fees and notifications

- **FR-13:** Fee status derives from due amounts and recorded payments/reversals. Fully paid or waived dues do not receive overdue reminders.
- **FR-14:** The application records payments received externally and never initiates or processes payment.
- **FR-15:** Fee reminders begin the day after the monthly join-date deadline, then repeat every other day while a balance remains, only for guardians who opted in.
- **FR-16:** An outside-presence event triggers a warden WhatsApp alert after more than two hours. An opted-in parent/guardian is alerted after more than four hours.
- **FR-17:** Alerts are deduplicated per student, recipient, threshold, and outside episode. A new inside-to-outside episode may create new alerts.
- **FR-18:** WhatsApp delivery requires configured Cloud API credentials, sender ID, phone numbers in international format, and approved templates. Delivery state and provider reference are logged. Missing configuration must be visible to administrators.
- **FR-19:** No recipient is messaged unless the relevant consent is recorded. Fee-reminder and safety-alert consent are independent.
- **FR-20:** The current reminder/alert worker is local-only. Production automation requires an always-on scheduled worker or supported job platform; Vercel request handlers must not be treated as a persistent process.

### Leave and family access

- **FR-21:** Wardens can review leave requests and retain an auditable decision history.
- **FR-22:** Approved leave suppresses applicable absence alerts for its authorized date range.
- **FR-23:** Parent access must verify the guardian's identity and relationship to the student before exposing personal or safety data.

## 8. Privacy, Security, and Audit Requirements

- Use individual named accounts; shared owner/admin email addresses are disallowed.
- Use least privilege, server-side role checks, institution scoping, secure password hashing, and expiring HTTP-only sessions.
- Do not expose credentials, tokens, guardian phone numbers, or student data in logs, client bundles, or public documents.
- Record audit events for institution provisioning, consent changes, access-sensitive actions, and presence updates.
- Record consent evidence with timestamp, purpose, notice/template version, and withdrawal state before production notifications are enabled. The current boolean consent fields are not sufficient evidence by themselves.
- Define data retention, correction, deletion, grievance, and breach-response procedures before using real student/guardian data.
- Apply and test database row-level security; current repository notes state that RLS is not yet enforced by the application data-access layer.
- Complete a privacy/security review for the Digital Personal Data Protection Act, 2023 and applicable rules. This PRD is not a legal opinion and does not certify compliance.

## 9. Non-Functional Requirements

- Institution data must remain isolated across every server-side query and mutation.
- Date thresholds use institution-local time; timestamps are stored in UTC.
- A failed notification attempt must not be marked as sent, and retries must not create duplicate messages.
- Student and payment APIs must fail clearly when the database is unavailable or required migrations are missing; the UI must not show a false empty state.
- Production and preview deployments must use separate environment/database configuration. Secrets must not be committed or printed.
- Operational notifications must expose worker health and last attempt status to an authorized administrator.

## 10. Success Measures

- 100% of platform-owner and institution-administrator account creation rejects duplicate management emails, including case-only variants.
- 0 cross-institution reads/writes in tenant-isolation tests.
- 0 duplicate successful messages for the same recipient and alert episode.
- Presence counts and status durations match the latest accepted gate/status event.
- Notification delivery is measurable by queued, sent, and failed counts without exposing message secrets.
- Institution provisioning completes with a named administrator and an initial facility layout, with no public signup path.

## 11. Current Implementation Status

### Implemented in the application

- Separate `/platform-login` and `/platform` owner routes and `/institution-login` and `/admin` staff routes.
- Platform-owner institution provisioning and facilities management.
- Case-insensitive unique-email migration and provisioning checks for `ADMIN`/`SUPER_ADMIN` accounts.
- Database-backed institution student/facility APIs and student inside/outside dashboard with manual status controls.
- Manual fee records and a local WhatsApp worker for fee and absence alerts, including consent checks and notification logs.
- Tests for portal separation, notification thresholds, and core workflows.

### Prototype, local-only, or incomplete

- The WhatsApp worker is not a Vercel persistent service and needs separately configured production scheduling and Meta credentials/templates.
- No live eSSL/gate-device feed is connected; presence is manually updated or simulated.
- Parent authentication/portal, portions of gate/leave workflows, and some demo data remain prototype-backed.
- Consent booleans are captured, but full consent evidence, withdrawal lifecycle, retention/deletion workflows, and privacy request handling remain to be designed.
- RLS is not currently enforced through the application data-access layer; production readiness requires this and a complete authorization review.
- The application is not certified as DPDP-compliant; real personal data should not be entered until the outstanding security and privacy controls are reviewed and implemented.

## 12. Release Acceptance Criteria

A release is acceptable when:

1. Platform owners sign in only to `/platform` and can provision institutions and configure facilities.
2. Institution administrators sign in only to their own institution workspace; platform-owner accounts are rejected by institution authentication.
3. Management account emails are unique case-insensitively, and existing conflicts block the migration with a clear, non-destructive error.
4. Student registration, facilities, presence, and fee APIs enforce institution boundaries.
5. WhatsApp notifications remain disabled unless credentials, approved templates, valid recipients, and required consent are present.
6. Production status clearly distinguishes live integrations from simulated or local-only behavior.
7. Privacy/security review, consent lifecycle, retention/deletion process, and RLS enforcement are completed before broad real-data use.
