$envFile = Get-Content -LiteralPath ".env.local"
$url = ($envFile | Select-String "TURSO_DATABASE_URL").ToString().Split('=')[1].Trim()
$token = ($envFile | Select-String "TURSO_AUTH_TOKEN").ToString().Split('=')[1].Trim()
$hostname = $url -replace '^libsql://',''

function Query([string]$name, [string]$sql) {
  Write-Output "=== $name ==="
  $body = @{ requests = @( @{ type = "execute"; stmt = @{ sql = $sql } } ) } | ConvertTo-Json -Depth 5
  $r = Invoke-RestMethod -Uri "https://$hostname/v2/pipeline" -Method Post -Headers @{Authorization="Bearer $token";'Content-Type'='application/json'} -Body $body
  $res = $r.results[0].response.result
  if ($res.type -eq 'error') { Write-Output "  ERR: $($res.error.message)"; Write-Output ""; return }
  $res.rows | ConvertTo-Json -Depth 4
  Write-Output ""
}

Write-Output "=== tabel yang ada ==="
Query "tables" "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%cour%'"

Write-Output "=== PRAGMA couriers ==="
Query "cour cols" "SELECT name, type FROM pragma_table_info('couriers')"

Write-Output "=== couriers ALL ==="
Query "cour all" "SELECT * FROM couriers LIMIT 10"