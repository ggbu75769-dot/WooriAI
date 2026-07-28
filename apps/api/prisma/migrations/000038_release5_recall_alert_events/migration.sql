ALTER TABLE "catalog_safety_alerts"
  DROP CONSTRAINT "ck_catalog_safety_alert_event";

ALTER TABLE "catalog_safety_alerts"
  ADD CONSTRAINT "ck_catalog_safety_alert_event"
  CHECK ("event_type" IN ('blocked', 'recalled', 'provider_recalled', 'provider_corrected'));
