CREATE UNIQUE INDEX "notification_log_institution_id_channel_template_key_target_id_key"
ON "notification_log"("institution_id", "channel", "template_key", "target_id");