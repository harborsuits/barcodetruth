$ErrorActionPreference = 'Stop'
$btRoot = Split-Path -Parent $PSScriptRoot
$btContainer = 'barcodetruth-test-' + [guid]::NewGuid().ToString('N').Substring(0, 12)
function Invoke-TestSql([string]$sql) {
  $sql | docker exec -i $btContainer psql -U postgres -d postgres -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) { throw 'SQL regression check failed' }
}
function Invoke-TestSqlFile([string]$path) { Invoke-TestSql (Get-Content -LiteralPath (Join-Path $btRoot $path) -Raw) }

docker run --detach --rm --name $btContainer --network none --env POSTGRES_PASSWORD=local-test-only --mount type=tmpfs,destination=/var/lib/postgresql/data postgres:16-alpine | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not start isolated PostgreSQL' }
try {
  $btReady = $false
  for ($btAttempt = 0; $btAttempt -lt 30; $btAttempt++) {
    docker exec $btContainer pg_isready -U postgres *> $null
    if ($LASTEXITCODE -eq 0) { $btReady = $true; break }
    Start-Sleep -Milliseconds 200
  }
  if (-not $btReady) { throw 'PostgreSQL did not become ready' }
  Invoke-TestSqlFile 'tests/sql/release-one-fixture.sql'
  Invoke-TestSqlFile 'supabase/migrations/20260327062128_b62539d3-2999-4348-945e-db5a4d4bff4c.sql'
  Invoke-TestSql @'
DO $test$ BEGIN
  PERFORM * FROM public.get_smart_alternatives('00000000-0000-0000-0000-000000000001',1);
  RAISE EXCEPTION 'Expected legacy UUID/TEXT error was not reproduced';
EXCEPTION WHEN undefined_function THEN RAISE NOTICE 'Legacy 42883 reproduced';
END; $test$;
'@
  Invoke-TestSqlFile 'supabase/migrations/20260913031534_repair_alternatives_contract.sql'
  Invoke-TestSqlFile 'supabase/migrations/20260913031732_repair_catalog_publication.sql'
  Invoke-TestSql @'
CREATE ROLE anon NOLOGIN;
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
SET ROLE anon;
'@
  # SET ROLE is connection-scoped, so include it with the assertions.
  Invoke-TestSql ("SET ROLE anon;`n" + (Get-Content -LiteralPath (Join-Path $btRoot 'tests/sql/release-one-assertions.sql') -Raw))
} finally {
  # Only the ephemeral, randomly named container created by this script is stopped.
  docker stop $btContainer | Out-Null
}
