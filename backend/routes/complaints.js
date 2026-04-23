const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const WorkflowAudit = require('../models/WorkflowAudit');
const executor = require('../engine/executor');
const validateWorkflowState = require('../middleware/validateWorkflowState');

// GET /api/complaints -> list all complaints
router.get('/', async (req, res) => {
  try {
    const filter = req.query.state ? { currentState: req.query.state } : {};
    const complaints = await Complaint.find(filter).sort({ createdAt: -1 });
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/complaints/:id -> get single complaint + full audit trail
router.get('/:id', async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ error: 'Not found' });
    
    const audits = await WorkflowAudit.find({ complaintId: req.params.id }).sort({ timestamp: -1 });
    
    res.json({ complaint, audits });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/complaints/:id/valid-transitions -> return allowed next states
router.get('/:id/valid-transitions', async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ error: 'Not found' });
    
    const workflow = executor.getWorkflow();
    const stateDef = workflow.states[complaint.currentState];
    
    res.json({ validTransitions: stateDef ? stateDef.transitions : [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/complaints -> create complaint
router.post('/', async (req, res) => {
  try {
    const { title, description, category, submittedBy } = req.body;
    const workflow = executor.getWorkflow();
    const initialState = workflow.initial_state || 'SUBMITTED';

    let complaint = new Complaint({
      title,
      description,
      category,
      submittedBy,
      currentState: initialState, // will be temporarily set to get an ID. Or we can just set it and let executor run it somehow. Wait! Executor processTransition from null -> SUBMITTED might be needed.
      history: [{ state: initialState, actor: submittedBy.name, note: 'Initial Submission' }]
    });

    await complaint.save();
    
    // According to specs, POST /api/complaints -> create complaint, set state=SUBMITTED, run notify_manager.sh
    // So we manually execute side effects representing the entry state?
    // Wait, let's treat the creation as 'entering SUBMITTED'.
    const stateDef = workflow.states[initialState];
    const timestamp = new Date();
    
    if (stateDef.actions && stateDef.actions.length > 0) {
      for (const script of stateDef.actions) {
        await executor._runScript(script, complaint._id, 'NEW', initialState, submittedBy.name, timestamp);
      }
    }
    
    res.status(201).json(complaint);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/complaints/:id/transition -> body: { toState, actor, note } -> validate + execute transition
router.post('/:id/transition', validateWorkflowState, async (req, res) => {
  try {
    const { toState, actor, note } = req.body;
    const complaint = await executor.processTransition(req.params.id, toState, actor, note);
    res.json(complaint);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
