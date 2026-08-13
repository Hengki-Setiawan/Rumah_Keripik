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

Query "TABLES" "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"

Query "ALL transaksi" "SELECT kode_pesanan, order_status, waktu_simpan, nama_penerima, alamat_penerima, lat_pengiriman, lng_pengiriman FROM transaksi ORDER BY waktu_simpan DESC"

Query "ALL deliveryAssignment" "SELECT * FROM deliveryAssignment LIMIT 20"

Query "columns deliveryAssignment" "PRAGMA table_info(deliveryAssignment)"

Query "columns transaksi" "PRAGMA table_info(transaksi)"
