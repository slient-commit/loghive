@echo off
echo ========================================
echo  Log Hive - Rebuild
echo ========================================

echo.
echo [1/4] Stopping containers...
docker compose down

echo.
echo [2/4] Removing images...
docker compose down --rmi local

echo.
echo [3/4] Rebuilding images...
docker compose build --no-cache

echo.
echo [4/4] Starting containers...
docker compose up -d

echo.
echo ========================================
echo  Log Hive is running on http://localhost
echo ========================================
echo.
echo  Seed the database:
echo    docker compose exec api node seed.js
echo.
