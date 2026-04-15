#!/bin/sh
mkdir -p ../logs
LOGFILE="../logs/complaint_${COMPLAINT_ID}.log"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [notify_rejection] Complaint ID: $COMPLAINT_ID" >> $LOGFILE
echo "Transition: $FROM_STATE -> $TO_STATE" >> $LOGFILE
echo "Actor: $ACTOR" >> $LOGFILE
echo "Action: Logging rejection." >> $LOGFILE

# Simulate rejection logic
echo "Complaint rejected." >> $LOGFILE

exit 0
