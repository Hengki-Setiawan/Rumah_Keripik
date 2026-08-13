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

# Simulasi persis WHERE clause route /today utk kurir id=1
Write-Output "=== SIMULASI: query today persis route (kurir_id=1) ==="
Query "TODAY kurir 1" "SELECT t.kode_pesanan, t.order_status, t.waktu_simpan, da.kurir_id, da.status assign_status FROM transaksi t LEFT JOIN delivery_assignment da ON t.id_transaksi=da.id_transaksi WHERE t.order_status IN ('ready','confirmed','shipping','awaiting_admin_confirmation','Menunggu_Verifikasi') AND (da.kurir_id = 1 OR (da.kurir_id IS NULL AND t.waktu_simpan >= '2026-08-13T00:00:00.000Z'))"

# Cek format waktu: ada 'T' atau spasi?
Write-Output "=== format waktu_simpan ==="
Query "instr" "SELECT kode_pesanan, waktu_simpan, instr(waktu_simpan,'T') has_T, length(waktu_simpan) len FROM transaksi ORDER BY waktu_simpan DESC LIMIT 10"

# Apa order_status yang dipakai order baru dari web/chat?
Query "distinct order_status" "SELECT order_status, count(*) n FROM transaksi GROUP BY order_status"

# Pesanan 'ready'/'confirmed' ada?
Query "status kosong" "SELECT kode_pesanan, order_status, waktu_simpan FROM transaksi WHERE order_status IN ('ready','confirmed','awaiting_admin_confirmation','Menunggu_Verifikasi')"

# delivery_status_audit / order_status_history untuk memahami pipeline status
Query "audit recent" "SELECT * FROM delivery_status_audit ORDER BY id DESC LIMIT 8"