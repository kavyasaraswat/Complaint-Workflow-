const mongoose = require('mongoose');

const WorkflowAuditSchema = new mongoose.Schema({
  complaintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true },
  fromState: { type: String, required: true },
  toState: { type: String, required: true },
  actor: { type: String, required: true },
  valid: { type: Boolean, required: true },
  reason: { type: String },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WorkflowAudit', WorkflowAuditSchema);
