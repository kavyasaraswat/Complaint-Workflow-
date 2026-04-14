const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const Complaint = require('../models/Complaint');
const WorkflowExecution = require('../models/WorkflowExecution');
const timeoutManager = require('./timeout-manager');
const Validator = require('./validator');

class Executor {
  constructor() {
    this.workflowPath = path.join(__dirname, '..', 'workflows', 'complaint.workflow.json');
    this.scriptsPath = path.join(__dirname, '..', 'scripts');
  }

  getWorkflow() {
    return JSON.parse(fs.readFileSync(this.workflowPath, 'utf8'));
  }

  async processTransition(complaintId, toState, actor, note = "") {
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) throw new Error('Complaint not found');

    const fromState = complaint.currentState;
    const workflow = this.getWorkflow();
    const validator = new Validator(workflow);

    const validation = await validator.validateTransition(complaintId, fromState, toState, actor, note);
    if (!validation.valid) {
      throw new Error(`Invalid transition: ${validation.reason}`);
    }

    const stateDef = workflow.states[fromState];
    const timestamp = new Date();

    // Side effect execution
    let failed = false;
    if (stateDef.actions && stateDef.actions.length > 0) {
      for (const script of stateDef.actions) {
        const result = await this._runScript(script, complaintId, fromState, toState, actor, timestamp);
        if (result.exitCode !== 0) {
          failed = true;
          // Compensating action handling
          if (stateDef.compensating) {
            console.error(`Script ${script} failed. Compensating actions should be implemented here.`);
          }
          throw new Error('Side effect script failed, state rolled back.');
        }
      }
    }

    // Determine timeout if the target state has one
    const targetStateDef = workflow.states[toState];
    let timeoutAt = null;
    timeoutManager.cancel(complaintId);

    if (targetStateDef && targetStateDef.timeout_ms) {
       timeoutAt = new Date(Date.now() + targetStateDef.timeout_ms);
       complaint.timeoutAt = timeoutAt;
       timeoutManager.schedule(complaintId, timeoutAt, targetStateDef.on_timeout);
    } else {
       complaint.timeoutAt = null;
    }

    // Save state
    complaint.currentState = toState;
    complaint.updatedAt = timestamp;
    if (targetStateDef && targetStateDef.terminal) {
      complaint.resolvedAt = timestamp;
    }

    complaint.history.push({
      state: toState,
      actor,
      note,
      timestamp
    });

    await complaint.save();
    return complaint;
  }

  _runScript(scriptName, complaintId, fromState, toState, actor, timestamp) {
    return new Promise(async (resolve) => {
      const scriptPath = path.join(this.scriptsPath, scriptName);
      const startTime = Date.now();

      // Ensure logs dir is created before script run (handled in script but safe here too)
      if (!fs.existsSync(path.join(__dirname, '..', 'logs'))) {
         fs.mkdirSync(path.join(__dirname, '..', 'logs'));
      }

      const env = {
        ...process.env,
        COMPLAINT_ID: complaintId.toString(),
        FROM_STATE: fromState,
        TO_STATE: toState,
        ACTOR: actor,
        TIMESTAMP: timestamp.toISOString()
      };

      // Need to use sh to execute shell scripts on windows (assumes git bash or wsl is available)
      const child = spawn('sh', [scriptPath], { env, cwd: this.scriptsPath, shell: true });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => stdout += data);
      child.stderr.on('data', (data) => stderr += data);

      child.on('close', async (code) => {
        const durationMs = Date.now() - startTime;
        
        await WorkflowExecution.create({
          complaintId,
          state: fromState,
          scriptName,
          exitCode: code,
          stdout,
          stderr,
          durationMs
        });

        resolve({ exitCode: code, stdout, stderr });
      });
    });
  }
}

module.exports = new Executor();
