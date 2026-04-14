const API_BASE = '/api';

// --- State ---
let currentRole = 'Employee';
let complaints = [];
let workflowDef = null;
let selectedComplaintId = null;

// DOM Elements
const roleSelect = document.getElementById('current-role');
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const activeList = document.getElementById('active-complaints-list');
const historyList = document.getElementById('all-complaints-list');
const complaintForm = document.getElementById('complaint-form');
const notificationsPanel = document.getElementById('notifications-panel');

// Details Panel
const detailsPanel = document.getElementById('complaint-details');
const placeholderPanel = document.getElementById('selection-placeholder');
const actionPanel = document.getElementById('action-panel');
const actionButtons = document.getElementById('action-buttons');
const rejectNoteBox = document.getElementById('reject-note-box');
const actionNote = document.getElementById('action-note');

// --- Initialization ---
async function init() {
  await fetchWorkflow();
  await fetchComplaints();
  
  if (currentRole === 'Employee') {
    document.getElementById('tab-submit').style.display = 'block';
  }

  // Polling
  setInterval(fetchComplaints, 5000);
}

// --- Event Listeners ---
roleSelect.addEventListener('change', (e) => {
  currentRole = e.target.value;
  document.getElementById('tab-submit').style.display = currentRole === 'Employee' ? 'block' : 'none';
  if (currentRole !== 'Employee' && document.querySelector('#tab-submit').classList.contains('active')) {
    switchTab('dashboard');
  }
  renderDashboard();
  if (selectedComplaintId) renderDetails(selectedComplaintId);
});

tabs.forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

complaintForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = {
    title: document.getElementById('title').value,
    category: document.getElementById('category').value,
    description: document.getElementById('description').value,
    submittedBy: {
      name: 'Alice', employeeId: 'E123', department: 'Engineering', email: 'alice@example.com'
    }
  };

  try {
    const res = await fetch(`${API_BASE}/complaints`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(formData)
    });
    if (res.ok) {
      notify('Complaint submitted successfully');
      complaintForm.reset();
      switchTab('dashboard');
      fetchComplaints();
    }
  } catch (error) {
    console.error(error);
  }
});

function switchTab(tabId) {
  tabs.forEach(t => t.classList.remove('active'));
  tabContents.forEach(c => c.classList.remove('active'));
  document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
  document.getElementById(`view-${tabId}`).classList.add('active');
}

// --- API Calls ---
async function fetchWorkflow() {
  try {
    const res = await fetch(`${API_BASE}/workflow/definition`);
    const data = await res.json();
    workflowDef = data.workflow;
  } catch (err) {
    console.error("Failed to load workflow", err);
  }
}

let lastStateMap = {};
async function fetchComplaints() {
  try {
    const res = await fetch(`${API_BASE}/complaints`);
    complaints = await res.json();
    
    // Check for new notifications
    complaints.forEach(c => {
      if (lastStateMap[c._id] && lastStateMap[c._id] !== c.currentState) {
        notify(`Complaint "${c.title}" moved to ${c.currentState}`);
      }
      lastStateMap[c._id] = c.currentState;
    });

    renderDashboard();
    renderHistory();
    if (selectedComplaintId) {
       // Refresh details if open
       if(complaints.find(c => c._id === selectedComplaintId)) {
          renderDetails(selectedComplaintId, false);
       }
    }
  } catch (err) {
    console.error('Fetch complaints error', err);
  }
}

// --- Rendering ---
function renderDashboard() {
  const isEmployee = currentRole === 'Employee';
  const isManager = currentRole === 'Manager';
  const isHR = currentRole === 'HR';

  document.getElementById('dashboard-title').innerText = isEmployee ? 'My Complaints' : (isManager ? 'Awaiting Manager Review' : 'Awaiting HR Review');

  activeList.innerHTML = '';
  
  const filtered = complaints.filter(c => {
    if (isEmployee) return true; // Show all to employee on dashboard for simplicity? Or just active. Let's just show all for Employee.
    if (isManager) return c.currentState === 'SUBMITTED';
    if (isHR) return c.currentState === 'MANAGER_REVIEW' || c.currentState === 'TIMEOUT_ESCALATION';
    return false;
  });

  if (filtered.length === 0) {
    activeList.innerHTML = '<p style="color:var(--text-muted)">No action items currently.</p>';
    return;
  }

  filtered.forEach(c => activeList.appendChild(createComplaintCard(c)));
}

function renderHistory() {
  historyList.innerHTML = '';
  complaints.forEach(c => historyList.appendChild(createComplaintCard(c)));
}

function createComplaintCard(c) {
  const div = document.createElement('div');
  div.className = 'complaint-item glass-card';
  div.onclick = () => { selectedComplaintId = c._id; renderDetails(c._id); };
  
  const badgeClass = c.currentState.toLowerCase();
  
  div.innerHTML = `
    <div class="item-header">
      <strong>${c.title}</strong>
      <span class="badge ${badgeClass}">${c.currentState}</span>
    </div>
    <div style="font-size:0.85rem; color:var(--text-muted)">
      ID: ${c._id.substring(0,8)} | Opened: ${new Date(c.createdAt).toLocaleDateString()}
    </div>
  `;
  return div;
}

async function renderDetails(id, animate = true) {
  placeholderPanel.style.display = 'none';
  detailsPanel.style.display = 'block';

  try {
    const res = await fetch(`${API_BASE}/complaints/${id}`);
    const { complaint, audits } = await res.json();

    document.getElementById('det-title').innerText = complaint.title;
    document.getElementById('det-badge').className = `badge ${complaint.currentState.toLowerCase()}`;
    document.getElementById('det-badge').innerText = complaint.currentState;
    document.getElementById('det-author').innerText = complaint.submittedBy.name;
    document.getElementById('det-date').innerText = new Date(complaint.createdAt).toLocaleString();
    document.getElementById('det-desc').innerText = complaint.description;

    // Actions
    renderActions(complaint);
    
    // Timeline
    const tl = document.getElementById('timeline');
    tl.innerHTML = '';
    complaint.history.forEach(h => {
      const li = document.createElement('li');
      li.className = `state-${h.state}`;
      li.innerHTML = `
        <strong>${h.state}</strong>
        <span class="tl-date">${new Date(h.timestamp).toLocaleString()}</span>
        <span class="tl-actor">${h.actor}</span>
        ${h.note ? `<span class="tl-note">"${h.note}"</span>` : ''}
      `;
      tl.appendChild(li);
    });

    // Workflow Graph
    drawWorkflowGraph(complaint.currentState);

  } catch (e) {
    console.error(e);
  }
}

async function renderActions(complaint) {
  actionButtons.innerHTML = '';
  rejectNoteBox.style.display = 'none';
  actionPanel.style.display = 'none';

  // Fetch valid transitions
  const res = await fetch(`${API_BASE}/complaints/${complaint._id}/valid-transitions`);
  const { validTransitions } = await res.json();

  if (!validTransitions || validTransitions.length === 0) return;

  const isManager = currentRole === 'Manager';
  const isHR = currentRole === 'HR';
  
  // Basic crude auth logic based on role context
  // Managers can act on SUBMITTED -> MANAGER_REVIEW, but valid transition from SUBMITTED is MANAGER_REVIEW (which is taking ownership basically)
  // Wait, if it's SUBMITTED, manager clicks "Take Review" -> moves to MANAGER_REVIEW.
  // Then MANAGER_REVIEW moves to HR_REVIEW or REJECTED_BY_MANAGER.
  
  let allowed = false;
  let buttonsHtml = '';
  let requiresNote = false;

  const makeBtn = (targetState, text, type="primary", cls="") => {
     let btn = document.createElement('button');
     btn.className = `btn ${type} ${cls}`;
     btn.innerText = text;
     btn.onclick = () => executeTransition(complaint._id, targetState, type === 'danger');
     return btn;
  }

  if (complaint.currentState === 'SUBMITTED' && isManager) {
     allowed = true;
     if(validTransitions.includes('MANAGER_REVIEW')) actionButtons.appendChild(makeBtn('MANAGER_REVIEW', 'Start Review'));
  } else if (complaint.currentState === 'MANAGER_REVIEW' && isManager) {
     allowed = true;
     if(validTransitions.includes('HR_REVIEW')) actionButtons.appendChild(makeBtn('HR_REVIEW', 'Escalate to HR'));
     if(validTransitions.includes('REJECTED_BY_MANAGER')) {
        rejectNoteBox.style.display = 'block';
        actionButtons.appendChild(makeBtn('REJECTED_BY_MANAGER', 'Reject', 'danger'));
     }
  } else if ((complaint.currentState === 'HR_REVIEW' || complaint.currentState === 'TIMEOUT_ESCALATION') && isHR) {
     allowed = true;
     if(validTransitions.includes('ACTION_TAKEN')) actionButtons.appendChild(makeBtn('ACTION_TAKEN', 'Resolve Issue'));
     if(validTransitions.includes('REJECTED_BY_HR')) {
        rejectNoteBox.style.display = 'block';
        actionButtons.appendChild(makeBtn('REJECTED_BY_HR', 'Reject', 'danger'));
     }
     if(validTransitions.includes('HR_REVIEW')) {
        // From timeout escalation -> HR Review
        actionButtons.appendChild(makeBtn('HR_REVIEW', 'Start HR Review'));
     }
  }

  if (allowed) actionPanel.style.display = 'block';
  actionNote.value = ''; // clear note
}

async function executeTransition(id, toState, isRejection) {
  let note = '';
  if (isRejection) {
    note = actionNote.value;
    if (!note) return alert("Please provide a reason for rejection.");
  }
  
  let actorName = currentRole === 'Employee' ? 'Alice' : (currentRole === 'Manager' ? 'Bob' : 'Carol');

  try {
    await fetch(`${API_BASE}/complaints/${id}/transition`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ toState, actor: actorName, note })
    });
    fetchComplaints();
  } catch (e) {
    console.error(e);
  }
}

// Notifications
function notify(msg) {
  const div = document.createElement('div');
  div.className = 'notification';
  div.innerText = msg;
  notificationsPanel.appendChild(div);
  setTimeout(() => div.remove(), 5000);
}

// --- Workflow DAG Renderer (Live SVG) ---
function drawWorkflowGraph(activeState) {
  if (!workflowDef) return;
  const svg = document.getElementById('workflow-svg');
  svg.innerHTML = ''; // clear

  const states = Object.keys(workflowDef.states);
  if (states.length === 0) return;

  // Extremely basic auto-layout logic for the specific workflow structure
  // Assigning static x, y based on known rough topology just to ensure it draws.
  const layout = {
    'SUBMITTED': {x: 300, y: 30},
    'MANAGER_REVIEW': {x: 300, y: 100},
    'HR_REVIEW': {x: 300, y: 170},
    'ACTION_TAKEN': {x: 300, y: 240},
    'REJECTED_BY_MANAGER': {x: 100, y: 170},
    'REJECTED_BY_HR': {x: 500, y: 240},
    'TIMEOUT_ESCALATION': {x: 500, y: 100}
  };

  const rectW = 140;
  const rectH = 35;
  
  // Draw definitions for arrow markers
  let defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  let marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', 'arrow');
  marker.setAttribute('viewBox', '0 0 10 10');
  marker.setAttribute('refX', '10');
  marker.setAttribute('refY', '5');
  marker.setAttribute('markerWidth', '6');
  marker.setAttribute('markerHeight', '6');
  marker.setAttribute('orient', 'auto-start-reverse');
  let path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
  path.setAttribute('fill', 'var(--text-muted)');
  marker.appendChild(path);
  defs.appendChild(marker);
  svg.appendChild(defs);

  // Draw edges
  states.forEach(state => {
    if (!layout[state]) layout[state] = {x: 300, y: 200}; // Fallback
    const p1 = layout[state];
    workflowDef.states[state].transitions.forEach(target => {
       const p2 = layout[target] || {x:300, y:200};
       
       let line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
       line.setAttribute('x1', p1.x);
       line.setAttribute('y1', p1.y + rectH/2);
       line.setAttribute('x2', p2.x);
       line.setAttribute('y2', p2.y - rectH/2);
       line.setAttribute('stroke', 'var(--text-muted)');
       line.setAttribute('stroke-width', '2');
       line.setAttribute('marker-end', 'url(#arrow)');
       
       if (workflowDef.states[target].terminal && target.includes('REJECT')) {
         line.setAttribute('strokeDasharray', '4');
         line.setAttribute('stroke', 'var(--state-rejected)');
       }
       svg.appendChild(line);
    });
  });

  // Draw nodes
  states.forEach(state => {
    let p = layout[state];
    let isCurrent = state === activeState;
    let def = workflowDef.states[state];

    let g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    let rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', p.x - rectW/2);
    rect.setAttribute('y', p.y - rectH/2);
    rect.setAttribute('width', rectW);
    rect.setAttribute('height', rectH);
    rect.setAttribute('rx', '6');
    
    // Determine color
    let fill = '#1e293b';
    let stroke = 'rgba(255,255,255,0.2)';
    
    if (isCurrent) {
        fill = 'var(--state-submitted)'; // Highlight actively
        stroke = '#fff';
    } else if (def.terminal) {
        if(state.includes('REJECT')) fill = 'rgba(239, 68, 68, 0.4)';
        else fill = 'rgba(16, 185, 129, 0.4)';
    }

    rect.setAttribute('fill', fill);
    rect.setAttribute('stroke', stroke);
    rect.setAttribute('stroke-width', isCurrent ? '2' : '1');
    g.appendChild(rect);

    let text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', p.x);
    text.setAttribute('y', p.y + 4);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', isCurrent ? '#fff' : 'var(--text-main)');
    text.setAttribute('font-size', '10px');
    text.setAttribute('font-family', 'Inter, sans-serif');
    text.textContent = state;
    g.appendChild(text);

    svg.appendChild(g);
  });
}

// Execute
init();
