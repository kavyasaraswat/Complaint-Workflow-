const express = require('express');
const router = express.Router();
const executor = require('../engine/executor');
const { execSync } = require('child_process');
const path = require('path');

// POST /api/workflow/interrupt -> send SIGUSR1 (pause timeouts)
router.post('/interrupt', (req, res) => {
  process.emit('SIGUSR1');
  res.json({ message: 'Interrupt signal sent (SIGUSR1), timeouts paused' });
});

// POST /api/workflow/resume -> send SIGUSR2 (resume timeouts)
router.post('/resume', (req, res) => {
  process.emit('SIGUSR2');
  res.json({ message: 'Resume signal sent (SIGUSR2), timeouts resumed' });
});

// GET /api/workflow/definition -> serve current workflow JSON + git log
router.get('/definition', (req, res) => {
  try {
    const workflow = executor.getWorkflow();
    let gitLog = '';
    try {
       gitLog = execSync('git log --oneline workflows/complaint.workflow.json', { cwd: path.join(__dirname, '..') }).toString();
    } catch(e) {
       gitLog = 'Git log not available (maybe not committed yet)';
    }

    res.json({ workflow, gitLog });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
