$envFile = Get-Content -LiteralPath ".env.local"
$url = ($envFile | Select-String "TURSO_DATABASE_URL").ToString().Split('=')[1].Trim()
$token = ($envFile | Select-String "TURSO_AUTH_TOKEN").ToString().Split('=')[1].Trim()
$hostname = $url -replace '^libsql://',''

function Query([string]$sql) {
  $body = @{ requests = @( @{ type = "execute"; stmt = @{ sql = $sql } } ) } | ConvertTo-Json -Depth 5
  $r = Invoke-RestMethod -Uri "https://$hostname/v2/pipeline" -Method Post -Headers @{Authorization="Bearer $token";'Content-Type'='application/json'} -Body $body
  $res = $r.results[0].response.result
  if ($res.type -eq 'error') { Write-Output "  ERR: $($res.error.message)"; return }
  $cols = $res.cols | ForEach-Object { $_.name }
  foreach ($row in $res.rows) {
    $row | ForEach-Object { $_.value } | ForEach-Object { $i=0; @($cols) | ForEach-Object { } }
  }
  # simpler: dump raw
  $res.rows | ConvertTo-Json -Depth 4
  Write-Output ""
}

Write-Output "=== T1: transaksi total + status ==="
Query "SELECT order_status, count(*) n FROM transaksi GROUP BY order_status"

Write-Output "=== T2: deliveryAssignment by status ==="
Query "SELECT status, count(*) n FROM deliveryAssignment GROUP BY status"

Write-Output "=== T3: transaksi 3 hari terakhir (dengan join assignment) ==="
Query "SELECT t.kode_pesanan, t.order_status, t.waktu_simpan, t.lat_pengiriman, t.lng_pengiriman, da.kurir_id, da.status as assign_status FROM transaksi t LEFT JOIN deliveryAssignment da ON t.id_transaksi=da.id_transaksi WHERE t.waktu_simpan >= datetime('now','-3 days') ORDER BY t.waktu_simpan DESC LIMIT 25"

Write-Output "=== T4: transaksi tanpa koordinat (lat null/empty) terbaru ==="
Query "SELECT t.kode_pesanan, t.order_status, t.waktu_simpan, da.kurir_id, da.status as assign_status FROM transaksi t LEFT JOIN deliveryAssignment da ON t.id_transaksi=da.id_transaksi WHERE t.lat_pengiriman IS NULL OR t.lat_pengiriman='' OR t.lng_pengiriman IS NULL OR t.lng_pengiriman='' ORDER BY t.waktu_simpan DESC LIMIT 15"

Write-Output "=== T5: kurir aktif ==="
Query "SELECT id, name, phone, last_lat, last_lng FROM couriers WHERE is_active=1"
