#!/bin/bash
# Mission Control V2 - Sync Cron Script
# Run this via external cron: */5 * * * * /path/to/sync-mc.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$SCRIPT_DIR/sync.log"

echo "$(date): Starting sync..." >> $LOG_FILE

# Run the sync
cd $SCRIPT_DIR
node scripts/sync-openclaw.js >> $LOG_FILE 2>&1
node scripts/sync-openclaw.js --executions >> $LOG_FILE 2>&1

echo "$(date): Sync complete" >> $LOG_FILE