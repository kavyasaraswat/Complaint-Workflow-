const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let cachedWorkflow = null;
let workflowCacheTime = 0;
let cachedCommit = '';
const CACHE_TTL_MS = 30000;

function getGitCommit() {
  try {
    return execSync('git log -1 --format="%H" -- workflows/complaint.workflow.json', { cwd: path.join(__dirname, '..') }).toString().trim();
  } catch (e) {
    return 'unknown';
  }
}

function getWorkflow() {
  const currentCommit = getGitCommit();
  const now = Date.now();

  if (cachedWorkflow && (now - workflowCacheTime < CACHE_TTL_MS) && currentCommit === cachedCommit) {
    return cachedWorkflow;
  }

  const buf = fs.readFileSync(path.join(__dirname, '..', 'workflows', 'complaint.workflow.json'), 'utf8');
  cachedWorkflow = JSON.parse(buf);
  workflowCacheTime = now;
  cachedCommit = currentCommit;

  return cachedWorkflow;
}

module.exports = async function validateWorkflowState(req, res, next) {
  try {
    const { toState } = req.body;
    const workflow = getWorkflow();
    const Complaint = require('../models/Complaint');
    
    // We only need to do minimal check here. The executor does the hardcore transition valid check.
    // Ensure the requested state exists in the workflow.
    if (!workflow.states[toState] && toState) {
        return res.status(400).json({ error: "Requested transition state does not exist in current workflow definition." });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Failed to validate workflow state', details: error.message });
  }
};
