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

Write-Output "=== PRAGMA delivery_assignment ==="
Query "cols" "SELECT name, type FROM pragma_table_info('delivery_assignment')"

Write-Output "=== delivery_assignment kurir_id type check ==="
Query "kurir ids" "SELECT DISTINCT kurir_id, typeof(kurir_id) FROM delivery_assignment"

Write-Output "=== courier table: id & name ==="
Query "couriers" "SELECT id, nama, no_hp, last_lat, last_lng FROM couriers"

Write-Output "=== transaksi id_transaksi vs kode ==="
Query "tx map" "SELECT id_transaksi, kode_pesanan, order_status, waktu_simpan FROM transaksi ORDER BY waktu_simpan DESC"