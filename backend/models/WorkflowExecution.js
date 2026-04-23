const mongoose = require('mongoose');

const WorkflowExecutionSchema = new mongoose.Schema({
  complaintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true },
  state: { type: String, required: true },
  scriptName: { type: String, required: true },
  exitCode: { type: Number },
  stdout: { type: String },
  stderr: { type: String },
  durationMs: { type: Number },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WorkflowExecution', WorkflowExecutionSchema);
