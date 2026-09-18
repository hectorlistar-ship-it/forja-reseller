@echo off
cd /d C:\forja-reseller\binance-bridge
if not exist logs mkdir logs
call npx tsx scripts/run-once.ts >> logs\bridge.log 2>&1