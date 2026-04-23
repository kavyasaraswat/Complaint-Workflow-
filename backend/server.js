const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const timeoutManager = require('./engine/timeout-manager');
const complaintsRoutes = require('./routes/complaints');
const workflowRoutes = require('./routes/workflow');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/complaints', complaintsRoutes);
app.use('/api/workflow', workflowRoutes);

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/complaint_workflow')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Signal Handlers
process.on('SIGUSR1', () => {
  console.log('Received SIGUSR1: Pausing all active workflow timeouts');
  timeoutManager.pauseAll();
});

process.on('SIGUSR2', () => {
  console.log('Received SIGUSR2: Resuming all paused workflow timeouts');
  timeoutManager.resumeAll();
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM: Gracefully draining in-flight transitions');
  // Persist state if needed, then exit
  mongoose.connection.close(false, () => {
    console.log('MongoDb connection closed.');
    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`Workflow Engine running on port ${PORT}`);
});
