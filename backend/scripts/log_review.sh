#!/bin/sh
mkdir -p ../logs
LOGFILE="../logs/complaint_${COMPLAINT_ID}.log"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [log_review] Complaint ID: $COMPLAINT_ID" >> $LOGFILE
echo "Transition: $FROM_STATE -> $TO_STATE" >> $LOGFILE
echo "Actor: $ACTOR" >> $LOGFILE
echo "Action: Manager started/completed review." >> $LOGFILE

# Simulate review logging
echo "Successfully logged manager review." >> $LOGFILE

exit 0
