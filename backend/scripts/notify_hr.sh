#!/bin/sh
mkdir -p ../logs
LOGFILE="../logs/complaint_${COMPLAINT_ID}.log"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [notify_hr] Complaint ID: $COMPLAINT_ID" >> $LOGFILE
echo "Transition: $FROM_STATE -> $TO_STATE" >> $LOGFILE
echo "Actor: $ACTOR" >> $LOGFILE
echo "Action: Notifying HR of escalated complaint." >> $LOGFILE

# Simulate notification logic
echo "Successfully sent notification to HR." >> $LOGFILE

exit 0
