# Offline Test Plan — Mode Pesawat / No Connectivity

## Scope
Test perilaku courier app saat kehilangan koneksi internet (airplane mode) dan saat koneksi kembali.

## Prasyarat
- Expo Go atau APK terinstall di device Android
- Developer mode: enable "Remote JS Debugging" (optional)
- Courier sudah clocked in dengan shift aktif

## Test Case 1: Status Indicator
1. Buka app saat online → lihat SyncIndicator (should show "Tersimpan" / synced state)
2. Enable airplane mode → SyncIndicator should show "Offline" + queue count
3. Disable airplane mode → SyncIndicator should return to synced state

## Test Case 2: Offline Delivery Accept
1. Enable airplane mode
2. Tap "Terima" on delivery offer
3. Verify: action ditunda (no error toast, showing "pending" indicator)
4. Disable airplane mode
5. Verify: delivery masuk ke daftar aktif dalam <10 detik

## Test Case 3: Offline Status Update
1. Enable airplane mode
2. Tap "Sampai di Lokasi" → should show "menunggu koneksi"
3. Tap "Selesaikan" → should show "menunggu koneksi"
4. Disable airplane mode
5. Verify: status updates terkirim berurutan dalam <30 detik
6. Verify: delivery marked as completed

## Test Case 4: Offline Location Queue
1. Enable airplane mode
2. Walk ~50m (or mock location change)
3. Verify: background task queues location updates
4. Disable airplane mode after 5 minutes
5. Verify: queued locations terkirim, last_lat/lng updated

## Test Case 5: Graceful Error Handling
1. Enable airplane mode
2. Navigate through all screens (Home, Deliveries, Profile, History)
3. Verify: No crash, no blank white screen
4. Verify: Error message ditampilkan dengan tombol "Coba Lagi"
5. Disable airplane mode
6. Verify: all screens load data kembali

## Test Case 6: Sync Recovery with Multiple Queued Actions
1. Enable airplane mode
2. Accept 2 deliveries
3. Mark "Sampai di Lokasi" for delivery #1
4. Mark "Selesai" for delivery #1
5. Mark "Gagal" for delivery #2 (with reason)
6. Disable airplane mode
7. Verify: All 4 actions executed in correct order
8. Verify: delivery #1 completed, delivery #2 failed

## Kriteria Lolos
- Tidak ada crash saat offline/online transition
- Queue tidak infinite (actions eventually sync)
- UI tidak misleading (clear status)
- Sync time <30 detik setelah koneksi kembali
- Tidak ada data ganda (duplicate delivery events)

## Catatan
- Gunakan `chrome://inspect` untuk debugging WebSocket-based state
- Record screen recording untuk dokumentasi
- Reset queue sebelum test: `AsyncStorage.clear()` via dev menu
