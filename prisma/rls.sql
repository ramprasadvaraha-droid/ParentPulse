-- Tenant scoping for every table that carries institution_id.
-- Each request must set local variable `app.current_institution_id` before tenant-scoped reads/writes.
-- Example:
-- SET LOCAL app.current_institution_id = '11111111-1111-1111-1111-111111111111';

ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY institutions_scope
ON institutions
FOR ALL
USING (id = current_setting('app.current_institution_id', true)::uuid)
WITH CHECK (id = current_setting('app.current_institution_id', true)::uuid);

CREATE POLICY subscription_plans_scope
ON subscription_plans
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY subscriptions_scope
ON subscriptions
FOR ALL
USING (institution_id = current_setting('app.current_institution_id', true)::uuid)
WITH CHECK (institution_id = current_setting('app.current_institution_id', true)::uuid);

CREATE POLICY users_scope
ON users
FOR ALL
USING (institution_id = current_setting('app.current_institution_id', true)::uuid)
WITH CHECK (institution_id = current_setting('app.current_institution_id', true)::uuid);

CREATE POLICY blocks_scope
ON blocks
FOR ALL
USING (institution_id = current_setting('app.current_institution_id', true)::uuid)
WITH CHECK (institution_id = current_setting('app.current_institution_id', true)::uuid);

CREATE POLICY rooms_scope
ON rooms
FOR ALL
USING (institution_id = current_setting('app.current_institution_id', true)::uuid)
WITH CHECK (institution_id = current_setting('app.current_institution_id', true)::uuid);

CREATE POLICY parents_scope
ON parents
FOR ALL
USING (institution_id = current_setting('app.current_institution_id', true)::uuid)
WITH CHECK (institution_id = current_setting('app.current_institution_id', true)::uuid);

CREATE POLICY students_scope
ON students
FOR ALL
USING (institution_id = current_setting('app.current_institution_id', true)::uuid)
WITH CHECK (institution_id = current_setting('app.current_institution_id', true)::uuid);

CREATE POLICY devices_scope
ON devices
FOR ALL
USING (institution_id = current_setting('app.current_institution_id', true)::uuid)
WITH CHECK (institution_id = current_setting('app.current_institution_id', true)::uuid);

CREATE POLICY gate_logs_scope
ON gate_logs
FOR ALL
USING (institution_id = current_setting('app.current_institution_id', true)::uuid)
WITH CHECK (institution_id = current_setting('app.current_institution_id', true)::uuid);

CREATE POLICY leave_requests_scope
ON leave_requests
FOR ALL
USING (institution_id = current_setting('app.current_institution_id', true)::uuid)
WITH CHECK (institution_id = current_setting('app.current_institution_id', true)::uuid);

CREATE POLICY alerts_scope
ON alerts
FOR ALL
USING (institution_id = current_setting('app.current_institution_id', true)::uuid)
WITH CHECK (institution_id = current_setting('app.current_institution_id', true)::uuid);

CREATE POLICY notification_log_scope
ON notification_log
FOR ALL
USING (institution_id = current_setting('app.current_institution_id', true)::uuid)
WITH CHECK (institution_id = current_setting('app.current_institution_id', true)::uuid);

CREATE POLICY institution_settings_scope
ON institution_settings
FOR ALL
USING (institution_id = current_setting('app.current_institution_id', true)::uuid)
WITH CHECK (institution_id = current_setting('app.current_institution_id', true)::uuid);

CREATE POLICY fee_dues_scope
ON fee_dues
FOR ALL
USING (institution_id = current_setting('app.current_institution_id', true)::uuid)
WITH CHECK (institution_id = current_setting('app.current_institution_id', true)::uuid);

CREATE POLICY payment_entries_scope
ON payment_entries
FOR ALL
USING (institution_id = current_setting('app.current_institution_id', true)::uuid)
WITH CHECK (institution_id = current_setting('app.current_institution_id', true)::uuid);

CREATE POLICY receipts_scope
ON receipts
FOR ALL
USING (institution_id = current_setting('app.current_institution_id', true)::uuid)
WITH CHECK (institution_id = current_setting('app.current_institution_id', true)::uuid);

CREATE POLICY audit_log_scope
ON audit_log
FOR ALL
USING (institution_id = current_setting('app.current_institution_id', true)::uuid)
WITH CHECK (institution_id = current_setting('app.current_institution_id', true)::uuid);

ALTER TABLE institutions FORCE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE blocks FORCE ROW LEVEL SECURITY;
ALTER TABLE rooms FORCE ROW LEVEL SECURITY;
ALTER TABLE parents FORCE ROW LEVEL SECURITY;
ALTER TABLE students FORCE ROW LEVEL SECURITY;
ALTER TABLE devices FORCE ROW LEVEL SECURITY;
ALTER TABLE gate_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE leave_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE alerts FORCE ROW LEVEL SECURITY;
ALTER TABLE notification_log FORCE ROW LEVEL SECURITY;
ALTER TABLE institution_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE fee_dues FORCE ROW LEVEL SECURITY;
ALTER TABLE payment_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
