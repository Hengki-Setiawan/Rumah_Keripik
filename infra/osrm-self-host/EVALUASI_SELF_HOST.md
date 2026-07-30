# Evaluasi Self-Host OSRM untuk Courier App

## Latar Belakang
Courier app saat ini menggunakan server OSRM publik (`router.project-osrm.org`) untuk menghitung rute. Server publik memiliki batas rate dan tidak ada jaminan SLA. Self-hosting memberikan kontrol penuh.

## Kebutuhan Server
| Item | Spesifikasi |
|------|-------------|
| CPU | 2+ cores (Intel/AMD x86_64) |
| RAM | 4 GB minimum, 8 GB recommended (Indonesia full extract ~4GB saat diproses) |
| Storage | 20 GB SSD (OSM PBF ~1.5GB + OSRM graph ~6GB) |
| OS | Ubuntu 22.04+ / Debian 12 |
| Docker | Yes |
| Network | Public IP dengan port 5000 dibuka |

## Estimasi Biaya Bulanan
| Provider | Plan | RAM | Harga/bulan |
|----------|------|-----|-------------|
| DigitalOcean | Basic Droplet | 4GB | $24 |
| Linode | Nanode 4GB | 4GB | $24 |
| Vultr | Cloud Compute 4GB | 4GB | $24 |
| Contabo | Cloud VPS S | 8GB | ~€8 (recommended) |

## Setup Steps (Linux VPS)
```bash
# 1. Install Docker
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker

# 2. Copy docker-compose.yml ke VPS
# 3. Download data & extract
wget https://download.geofabrik.de/asia/indonesia-latest.osm.pbf
docker run --rm -v $(pwd):/data ghcr.io/project-osrm/osrm-backend osrm-extract -p /opt/car.lua /data/indonesia-latest.osm.pbf
docker run --rm -v $(pwd):/data ghcr.io/project-osrm/osrm-backend osrm-partition /data/indonesia-latest.osrm
docker run --rm -v $(pwd):/data ghcr.io/project-osrm/osrm-backend osrm-customize /data/indonesia-latest.osrm

# 4. Start service
docker compose up -d
```

## Perbandingan: Public vs Self-Host
| Aspek | Public OSRM | Self-Host |
|-------|-------------|-----------|
| Rate limit | 2 req/s (unauthenticated) | Unlimited |
| SLA | None | Controlled |
| Indonesia coverage | Yes (global) | Same data |
| Latency | ~200-500ms | <10ms (local network) |
| Biaya | Gratis | $8-24/bulan |
| Maintenance | None | Backup, update, monitoring |
| OSM update | Real-time | Manual (bulanan) |

## Rekomendasi
- **Untuk MVP / awal**: Tetap pakai `router.project-osrm.org` — gratis dan sudah mencukupi.
- **Jika traffic tinggi (>100 route request/hari) atau butuh SLA**: Self-host di Contabo 8GB (~€8/bulan).
- **Alternatif ringan**: Gunakan `graphhopper` (Java, butuh ~2GB RAM) atau OSRM dengan regional extract (Sulawesi saja, bukan seluruh Indonesia) untuk menghemat RAM.
- **Regional OSRM**: Buat extract khusus Sulawesi (lebih kecil, lebih cepat startup).
