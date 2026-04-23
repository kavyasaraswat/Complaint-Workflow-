const mongoose = require('mongoose');

const ComplaintSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  submittedBy: {
    name: { type: String, required: true },
    employeeId: { type: String, required: true },
    department: { type: String, required: true },
    email: { type: String, required: true },
  },
  currentState: { type: String, required: true, default: 'SUBMITTED' },
  history: [
    {
      state: { type: String, required: true },
      actor: { type: String, required: true },
      note: { type: String },
      timestamp: { type: Date, default: Date.now },
      scriptOutput: { type: String }
    }
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date },
  timeoutAt: { type: Date },
  isInterrupted: { type: Boolean, default: false }
});

module.exports = mongoose.model('Complaint', ComplaintSchema);
