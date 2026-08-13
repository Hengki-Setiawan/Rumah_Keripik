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

Query "delivery_assignment ALL" "SELECT * FROM delivery_assignment LIMIT 30"

Query "delivery_assignment by kurir/status" "SELECT kurir_id, status, count(*) n FROM delivery_assignment GROUP BY kurir_id, status"

Query "JOIN transaksi+assignment 3 days" "SELECT t.kode_pesanan, t.order_status, t.waktu_simpan, t.lat_pengiriman, da.kurir_id, da.status assign_status FROM transaksi t LEFT JOIN delivery_assignment da ON t.id_transaksi=da.id_transaksi WHERE t.waktu_simpan >= '2026-08-11' ORDER BY t.waktu_simpan DESC LIMIT 30"

Query "waktu terbaru" "SELECT max(waktu_simpan) mx, min(waktu_simpan) mn FROM transaksi"

Query "shifts" "SELECT id, courier_id, status, clock_in_at, clock_out_at FROM shifts ORDER BY id DESC LIMIT 5"

Query "transaksi unassigned hari ini?" "SELECT kode_pesanan, order_status, waktu_simpan FROM transaksi WHERE waktu_simpan >= '2026-08-13' ORDER BY waktu_simpan DESC"
