const WorkflowAudit = require('../models/WorkflowAudit');

class Validator {
  constructor(workflowDef) {
    this.workflow = workflowDef;
  }

  async validateTransition(complaintId, fromState, toState, actor, note) {
    const stateDef = this.workflow.states[fromState];

    if (!stateDef) {
      return await this._logAudit(complaintId, fromState, toState, actor, false, "Unknown current state");
    }

    if (!stateDef.transitions.includes(toState)) {
      return await this._logAudit(complaintId, fromState, toState, actor, false, `Invalid transition. Allowed: ${stateDef.transitions.join(', ')}`);
    }

    return await this._logAudit(complaintId, fromState, toState, actor, true, "Valid transition");
  }

  async _logAudit(complaintId, fromState, toState, actor, valid, reason) {
    await WorkflowAudit.create({
      complaintId,
      fromState,
      toState,
      actor,
      valid,
      reason
    });
    
    return { valid, reason, allowed: this.workflow.states[fromState]?.transitions || [] };
  }
}

module.exports = Validator;
