#!/bin/sh
mkdir -p ../logs
LOGFILE="../logs/complaint_${COMPLAINT_ID}.log"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [notify_manager] Complaint ID: $COMPLAINT_ID" >> $LOGFILE
echo "Transition: $FROM_STATE -> $TO_STATE" >> $LOGFILE
echo "Actor: $ACTOR" >> $LOGFILE
echo "Action: Notifying manager of new complaint." >> $LOGFILE

# Simulate notification logic
echo "Successfully sent notification to Manager." >> $LOGFILE

exit 0
