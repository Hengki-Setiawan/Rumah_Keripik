# OSRM Self-Host Setup for Indonesia (Sulawesi)
# Requires: Docker Desktop + ~8GB free disk
# Run this script from PowerShell as Administrator

$REGION = "indonesia"  # Geofabrik region name
$EXTRACT_URL = "https://download.geofabrik.de/asia/$REGION-latest.osm.pbf"
$PROFILE = "car"       # Options: car, bicycle, foot

Write-Host "=== OSRM Self-Host Setup ===" -ForegroundColor Cyan

# Step 1: Download Indonesia OSM extract
Write-Host "[1/4] Downloading $REGION extract from Geofabrik..." -ForegroundColor Yellow
if (-not (Test-Path "data\$REGION-latest.osm.pbf")) {
    New-Item -ItemType Directory -Path "data" -Force | Out-Null
    Invoke-WebRequest -Uri $EXTRACT_URL -OutFile "data\$REGION-latest.osm.pbf"
} else {
    Write-Host "  Already downloaded, skipping" -ForegroundColor Green
}

# Step 2: Extract OSRM graph
Write-Host "[2/4] Extracting OSRM graph (can take 10-30 min)..." -ForegroundColor Yellow
docker run --rm -v ${PWD}/data:/data ghcr.io/project-osrm/osrm-backend `
    osrm-extract -p /opt/$PROFILE.lua /data/$REGION-latest.osm.pbf

# Step 3: Partition + customize (MLD algorithm)
Write-Host "[3/4] Partitioning graph (MLD)..." -ForegroundColor Yellow
docker run --rm -v ${PWD}/data:/data ghcr.io/project-osrm/osrm-backend `
    osrm-partition /data/$REGION-latest.osrm

docker run --rm -v ${PWD}/data:/data ghcr.io/project-osrm/osrm-backend `
    osrm-customize /data/$REGION-latest.osrm

# Step 4: Start server
Write-Host "[4/4] Starting OSRM server on port 5000..." -ForegroundColor Yellow
docker compose up -d

Write-Host "=== Done! ===" -ForegroundColor Cyan
Write-Host "Test: curl http://localhost:5000/health"
Write-Host "Route query example:"
Write-Host '  curl "http://localhost:5000/route/v1/driving/119.4,-5.1;119.5,-5.2?overview=false"'
