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

# Bukti bug format: '2026-08-12 23:30:00' (spasi, UTC, dibuat 07:30 WITA tgl 13) vs witaTodayStartIso
# Hari ini WITA = 2026-08-13 -> witaTodayStartIso() = '2026-08-12T16:00:00.000Z'
Write-Output "=== BUKTI BUG FORMAT WAKTU (string compare) ==="
Query "string-compare" "SELECT '2026-08-12 23:30:00' >= '2026-08-12T16:00:00.000Z' AS string_compare, julianday('2026-08-12 23:30:00') >= julianday('2026-08-12T16:00:00.000Z') AS julianday_compare"
Query "julianday both" "SELECT strftime('%Y-%m-%d %H:%M:%S', '2026-08-12T16:00:00.000Z') AS boundary_in_db_format"

# Bagaimana witaTodayStartIso terlihat di DB-format (pakai julianday pasangan)
Query "contoh pesanan baru hari ini" "SELECT '2026-08-12 23:30:00' AS waktu_simpan_new_order, julianday('2026-08-12 23:30:00') >= julianday('2026-08-12T16:00:00.000Z') AS should_show"

# Auto-assign? apakah delivery_assignment dibuat otomatis saat order?
Query "auto-assign check" "SELECT sql FROM sqlite_master WHERE type='trigger' AND tbl_name IN ('transaksi','delivery_assignment')"