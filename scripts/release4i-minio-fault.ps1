param(
  [string]$ApiBaseUrl = "http://127.0.0.1:53100",
  [string]$FixturePath = "apps/api/test/fixtures/release4i-local-staging-import.csv"
)

$ErrorActionPreference = "Stop"
$health = $null
for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
  try {
    $health = Invoke-WebRequest -UseBasicParsing -Uri "$ApiBaseUrl/api/v1/health" -TimeoutSec 2
    if ($health.StatusCode -eq 200) { break }
  } catch {
    $health = $null
  }
  Start-Sleep -Seconds 1
}
if (-not $health -or $health.StatusCode -ne 200) { throw "API_NOT_READY" }

docker stop wooriai-release4c-minio-1 | Out-Null
try {
  $failed = & curl.exe -sS -w "`nHTTP_STATUS:%{http_code}" `
    -H "x-admin-token: dev-admin-token" `
    -F "file=@$FixturePath;type=text/csv" `
    "$ApiBaseUrl/api/v1/admin/catalog/imports/file-preview" 2>&1
} finally {
  docker start wooriai-release4c-minio-1 | Out-Null
}

$deadline = (Get-Date).AddSeconds(45)
do {
  Start-Sleep -Seconds 1
  $state = (docker inspect --format "{{.State.Health.Status}}" wooriai-release4c-minio-1 2>$null).Trim()
} while ($state -ne "healthy" -and (Get-Date) -lt $deadline)

$failureText = $failed -join "`n"
if ($failureText -notmatch "HTTP_STATUS:5\d\d") { throw "MINIO_FAILURE_FALSE_SUCCESS: $failureText" }
if ($state -ne "healthy") { throw "MINIO_DID_NOT_RECOVER" }

[ordered]@{
  failureResponse = $failureText
  minioHealth = $state
} | ConvertTo-Json -Depth 4
