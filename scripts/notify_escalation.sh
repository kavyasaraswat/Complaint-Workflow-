#!/bin/sh
mkdir -p ../logs
LOGFILE="../logs/complaint_${COMPLAINT_ID}.log"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [notify_escalation] Complaint ID: $COMPLAINT_ID" >> $LOGFILE
echo "Transition: $FROM_STATE -> $TO_STATE" >> $LOGFILE
echo "Actor: $ACTOR" >> $LOGFILE
echo "Action: Timeout escalation." >> $LOGFILE

# Simulate escalation logic
echo "Complaint escalated due to timeout." >> $LOGFILE

exit 0
