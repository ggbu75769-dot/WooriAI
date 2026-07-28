param([int]$TimeoutSeconds = 120)

$ErrorActionPreference = "Stop"
$worker1 = "wooriai-release4c-worker-1"
$worker2 = "wooriai-release4c-worker-2"
$postgres = "wooriai-release4c-postgres-1"
$dedupeKey = "release4i-local-ack-$([guid]::NewGuid().ToString('N'))"
$before = (docker inspect --format "{{.RestartCount}}|{{.State.Pid}}" $worker1).Trim()

docker stop $worker2 | Out-Null
try {
  $flag = (docker exec $worker1 sh -lc "printf '%s' `$RELEASE4I_NOTIFICATION_ACK_FAILPOINT").Trim()
  if ($flag -ne "1") { throw "ACK_FAILPOINT_NOT_ENABLED" }
  docker exec $worker1 sh -lc "touch /tmp/wooriai-release4i-notification-ack-loss"

  $sql = @"
WITH target_user AS (
  SELECT id FROM users ORDER BY created_at LIMIT 1
), created_delivery AS (
  INSERT INTO notification_deliveries (user_id, event_type, dedupe_key, state, scheduled_at)
  SELECT id, 'release4i_local_ack_loss', '$dedupeKey', 'queued', now() FROM target_user
  RETURNING id
)
INSERT INTO job_outbox (topic, aggregate_type, aggregate_id, dedupe_key, payload_json, updated_at)
SELECT 'notification.send', 'notification_delivery', id::text, '$dedupeKey', jsonb_build_object('notificationDeliveryId', id::text), now()
FROM created_delivery
RETURNING aggregate_id;
"@
  $deliveryOutput = (docker exec $postgres psql -U wooriai -d wooriai_dev -Atc $sql) -split "`r?`n"
  $deliveryId = $deliveryOutput[0].Trim()
  if (-not $deliveryId) { throw "ACK_FAULT_DELIVERY_NOT_CREATED" }

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $state = ""
  do {
    Start-Sleep -Seconds 1
    $state = (docker exec $postgres psql -U wooriai -d wooriai_dev -Atc "SELECT state::text || '|' || retry_count || '|' || COALESCE(failure_code,'') FROM notification_deliveries WHERE id = '$deliveryId';").Trim()
    $restart = [int](((docker inspect --format "{{.RestartCount}}" $worker1).Trim()))
  } while (($state -notmatch '^sent\|') -and (Get-Date) -lt $deadline)

  $attempts = (docker exec $postgres psql -U wooriai -d wooriai_dev -Atc "SELECT count(*) || '|' || string_agg(state::text, ',') FROM notification_delivery_attempts WHERE notification_delivery_id = '$deliveryId';").Trim()
  $after = (docker inspect --format "{{.RestartCount}}|{{.State.Pid}}|{{.State.Running}}" $worker1).Trim()
  if ($restart -le [int](($before -split '\|')[0])) { throw "ACK_FAULT_WORKER_DID_NOT_RESTART" }
  if ($state -notmatch '^sent\|0\|$') { throw "ACK_FAULT_NOT_RECONCILED: $state" }
  if ($attempts -ne "1|sent") { throw "ACK_FAULT_DUPLICATE_ATTEMPT: $attempts" }

  [ordered]@{
    deliveryId = $deliveryId
    dedupeKey = $dedupeKey
    workerBefore = $before
    workerAfter = $after
    deliveryState = $state
    attempts = $attempts
    duplicateVisibleEffects = 0
    providerMode = "mock"
  } | ConvertTo-Json -Depth 4
} finally {
  docker start $worker2 | Out-Null
}
