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

  // Polling every 5 seconds
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
      notify('✅ Complaint submitted successfully');
      complaintForm.reset();
      switchTab('dashboard');
      fetchComplaints();
    }
  } catch (error) {
    console.error(error);
    notify('❌ Failed to submit complaint');
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
        notify(`🔄 "${c.title}" moved to ${c.currentState}`);
      }
      lastStateMap[c._id] = c.currentState;
    });

    renderDashboard();
    renderHistory();

    if (selectedComplaintId) {
      if (complaints.find(c => c._id === selectedComplaintId)) {
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

  const titles = {
    Employee: 'My Complaints',
    Manager: '📋 Awaiting Manager Action',
    HR: '📋 Awaiting HR Action'
  };
  document.getElementById('dashboard-title').innerText = titles[currentRole] || 'Dashboard';

  activeList.innerHTML = '';

  const filtered = complaints.filter(c => {
    if (isEmployee) return true;
    if (isManager) return c.currentState === 'SUBMITTED' || c.currentState === 'MANAGER_REVIEW';
    if (isHR) return c.currentState === 'HR_REVIEW' || c.currentState === 'TIMEOUT_ESCALATION' || c.currentState === 'APPROVED_BY_MANAGER';
    return false;
  });

  if (filtered.length === 0) {
    activeList.innerHTML = '<p style="color:var(--text-muted); padding: 1rem 0;">No action items currently.</p>';
    return;
  }

  filtered.forEach(c => activeList.appendChild(createComplaintCard(c, true)));
}

function renderHistory() {
  historyList.innerHTML = '';
  complaints.forEach(c => historyList.appendChild(createComplaintCard(c, false)));
}

// getActorName helper
function getActorName() {
  if (currentRole === 'Manager') return 'Bob';
  if (currentRole === 'HR') return 'Carol';
  return 'Alice';
}

// Determine available quick actions for current role & state
function getQuickActions(c) {
  const s = c.currentState;
  const role = currentRole;
  const actions = [];

  if (role === 'Manager') {
    if (s === 'SUBMITTED') {
      actions.push({ label: '▶ Start Review', toState: 'MANAGER_REVIEW', type: 'primary', needsNote: false });
    } else if (s === 'MANAGER_REVIEW') {
      actions.push({ label: '✅ Accept', toState: 'APPROVED_BY_MANAGER', type: 'success', needsNote: false });
      actions.push({ label: '⬆ Escalate to HR', toState: 'HR_REVIEW', type: 'warning', needsNote: false });
      actions.push({ label: '❌ Reject', toState: 'REJECTED_BY_MANAGER', type: 'danger', needsNote: true });
    }
  } else if (role === 'HR') {
    if (s === 'APPROVED_BY_MANAGER') {
      actions.push({ label: '▶ Start HR Review', toState: 'HR_REVIEW', type: 'primary', needsNote: false });
    } else if (s === 'HR_REVIEW' || s === 'TIMEOUT_ESCALATION') {
      if (s === 'TIMEOUT_ESCALATION') {
        actions.push({ label: '▶ Start HR Review', toState: 'HR_REVIEW', type: 'primary', needsNote: false });
      } else {
        actions.push({ label: '✅ Accept', toState: 'ACTION_TAKEN', type: 'success', needsNote: false });
        actions.push({ label: '❌ Reject', toState: 'REJECTED_BY_HR', type: 'danger', needsNote: true });
      }
    }
  }
  return actions;
}

function createComplaintCard(c, showActions) {
  const div = document.createElement('div');
  div.className = 'complaint-item glass-card';

  const stateLower = c.currentState.toLowerCase().replace(/_/g, '_');
  const actions = showActions ? getQuickActions(c) : [];

  div.innerHTML = `
    <div class="item-header" style="cursor:pointer;" onclick="selectComplaint('${c._id}')">
      <strong>${c.title}</strong>
      <span class="badge ${stateLower}">${c.currentState.replace(/_/g, ' ')}</span>
    </div>
    <div style="font-size:0.82rem; color:var(--text-muted); margin-top:4px; cursor:pointer;" onclick="selectComplaint('${c._id}')">
      <span>${c.category || 'General'}</span> &nbsp;·&nbsp;
      <span>By ${c.submittedBy ? c.submittedBy.name : 'Unknown'}</span> &nbsp;·&nbsp;
      <span>${new Date(c.createdAt).toLocaleDateString()}</span>
    </div>
    ${actions.length > 0 ? `
    <div class="card-actions" id="card-actions-${c._id}">
      ${actions.map(a => `
        <button class="btn ${a.type} btn-sm" onclick="handleCardAction('${c._id}', '${a.toState}', ${a.needsNote}, this)">
          ${a.label}
        </button>
      `).join('')}
    </div>
    ${actions.some(a => a.needsNote) ? `
    <div class="card-note-box" id="card-note-${c._id}" style="display:none; margin-top:8px;">
      <input type="text" id="card-note-input-${c._id}" placeholder="Reason for rejection (required)" style="width:100%; font-size:0.85rem;" />
    </div>
    ` : ''}
    ` : ''}
  `;
  return div;
}

function selectComplaint(id) {
  selectedComplaintId = id;
  renderDetails(id);
}

// Handle quick action from a complaint card
async function handleCardAction(id, toState, needsNote, btnEl) {
  if (needsNote) {
    const noteBox = document.getElementById(`card-note-${id}`);
    if (noteBox && noteBox.style.display === 'none') {
      noteBox.style.display = 'block';
      btnEl.textContent = '⬆ Confirm Rejection';
      return;
    }
    const noteInput = document.getElementById(`card-note-input-${id}`);
    const note = noteInput ? noteInput.value.trim() : '';
    if (!note) {
      alert('Please provide a reason for rejection.');
      return;
    }
    await executeTransition(id, toState, getActorName(), note);
  } else {
    await executeTransition(id, toState, getActorName(), '');
  }
}

async function renderDetails(id, animate = true) {
  placeholderPanel.style.display = 'none';
  detailsPanel.style.display = 'block';

  try {
    const res = await fetch(`${API_BASE}/complaints/${id}`);
    const { complaint, audits } = await res.json();

    document.getElementById('det-title').innerText = complaint.title;
    const badge = document.getElementById('det-badge');
    const badgeClass = complaint.currentState.toLowerCase().replace(/_/g, '_');
    badge.className = `badge ${badgeClass}`;
    badge.innerText = complaint.currentState.replace(/_/g, ' ');
    document.getElementById('det-author').innerText = complaint.submittedBy.name;
    document.getElementById('det-date').innerText = new Date(complaint.createdAt).toLocaleString();
    document.getElementById('det-desc').innerText = complaint.description;

    // Actions — wait for it to complete
    await renderActions(complaint);

    // Timeline
    const tl = document.getElementById('timeline');
    tl.innerHTML = '';
    complaint.history.forEach(h => {
      const li = document.createElement('li');
      li.className = `state-${h.state}`;
      li.innerHTML = `
        <strong>${h.state.replace(/_/g, ' ')}</strong>
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

  // Fetch valid transitions from the API
  let validTransitions = [];
  try {
    const res = await fetch(`${API_BASE}/complaints/${complaint._id}/valid-transitions`);
    const data = await res.json();
    validTransitions = data.validTransitions || [];
  } catch (e) {
    console.error('Could not fetch valid transitions', e);
    return;
  }

  if (validTransitions.length === 0) {
    // Terminal state — show a message
    actionPanel.style.display = 'block';
    actionPanel.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">⏹ This complaint is in a <strong>terminal state</strong> — no further actions available.</p>`;
    return;
  }

  // Reset action panel inner HTML to the original structure
  actionPanel.innerHTML = `
    <h4>⚡ Available Actions</h4>
    <div id="action-buttons" class="btn-group"></div>
    <div id="reject-note-box" style="display:none; margin-top:12px;">
      <input type="text" id="action-note" placeholder="Reason (required for rejection)" style="width:100%;" />
    </div>
  `;

  const freshActionButtons = document.getElementById('action-buttons');
  const freshRejectNoteBox = document.getElementById('reject-note-box');
  const freshActionNote = document.getElementById('action-note');

  const makeBtn = (targetState, label, type) => {
    const btn = document.createElement('button');
    btn.className = `btn ${type}`;
    btn.innerText = label;
    btn.id = `action-btn-${targetState.toLowerCase()}`;
    btn.onclick = async () => {
      const isRejection = targetState.includes('REJECTED');
      if (isRejection) {
        if (freshRejectNoteBox.style.display === 'none') {
          freshRejectNoteBox.style.display = 'block';
          btn.innerText = '⬆ Confirm ' + label;
          return;
        }
        const note = freshActionNote.value.trim();
        if (!note) { alert('Please provide a reason for rejection.'); return; }
        await executeTransition(complaint._id, targetState, getActorName(), note);
      } else {
        await executeTransition(complaint._id, targetState, getActorName(), '');
      }
    };
    return btn;
  };

  const isManager = currentRole === 'Manager';
  const isHR = currentRole === 'HR';
  let allowed = false;
  const s = complaint.currentState;

  if (s === 'SUBMITTED' && isManager) {
    allowed = true;
    if (validTransitions.includes('MANAGER_REVIEW'))
      freshActionButtons.appendChild(makeBtn('MANAGER_REVIEW', '▶ Start Review', 'primary'));
  } else if (s === 'MANAGER_REVIEW' && isManager) {
    allowed = true;
    if (validTransitions.includes('APPROVED_BY_MANAGER'))
      freshActionButtons.appendChild(makeBtn('APPROVED_BY_MANAGER', '✅ Accept', 'success'));
    if (validTransitions.includes('HR_REVIEW'))
      freshActionButtons.appendChild(makeBtn('HR_REVIEW', '⬆ Escalate to HR', 'warning'));
    if (validTransitions.includes('REJECTED_BY_MANAGER'))
      freshActionButtons.appendChild(makeBtn('REJECTED_BY_MANAGER', '❌ Reject', 'danger'));
  } else if (s === 'APPROVED_BY_MANAGER' && isHR) {
    allowed = true;
    if (validTransitions.includes('HR_REVIEW'))
      freshActionButtons.appendChild(makeBtn('HR_REVIEW', '▶ Start HR Review', 'primary'));
  } else if ((s === 'HR_REVIEW' || s === 'TIMEOUT_ESCALATION') && isHR) {
    allowed = true;
    if (s === 'TIMEOUT_ESCALATION' && validTransitions.includes('HR_REVIEW')) {
      freshActionButtons.appendChild(makeBtn('HR_REVIEW', '▶ Start HR Review', 'primary'));
    } else {
      if (validTransitions.includes('ACTION_TAKEN'))
        freshActionButtons.appendChild(makeBtn('ACTION_TAKEN', '✅ Accept', 'success'));
      if (validTransitions.includes('REJECTED_BY_HR'))
        freshActionButtons.appendChild(makeBtn('REJECTED_BY_HR', '❌ Reject', 'danger'));
    }
  }

  if (allowed) {
    actionPanel.style.display = 'block';
  } else if (currentRole !== 'Employee') {
    // Role is active but no action available for this state
    actionPanel.style.display = 'block';
    actionPanel.innerHTML += `<p style="color:var(--text-muted); font-size:0.85rem; margin-top:8px;">No actions available for your role in this state.</p>`;
  }
}

async function executeTransition(id, toState, actor, note) {
  try {
    const res = await fetch(`${API_BASE}/complaints/${id}/transition`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ toState, actor, note })
    });
    if (!res.ok) {
      const err = await res.json();
      alert(`Transition failed: ${err.error || 'Unknown error'}`);
      return;
    }
    notify(`✅ Moved to: ${toState.replace(/_/g, ' ')}`);
    await fetchComplaints();
    if (selectedComplaintId === id) renderDetails(id);
  } catch (e) {
    console.error(e);
    notify('❌ Failed to execute transition');
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
  if (!svg) return;
  svg.innerHTML = '';

  const states = Object.keys(workflowDef.states);
  if (states.length === 0) return;

  const layout = {
    'SUBMITTED':            { x: 300, y: 40 },
    'MANAGER_REVIEW':       { x: 300, y: 110 },
    'APPROVED_BY_MANAGER':  { x: 110, y: 185 },
    'HR_REVIEW':            { x: 300, y: 185 },
    'ACTION_TAKEN':         { x: 300, y: 260 },
    'REJECTED_BY_MANAGER':  { x: 110, y: 110 },
    'REJECTED_BY_HR':       { x: 490, y: 260 },
    'TIMEOUT_ESCALATION':   { x: 490, y: 110 }
  };

  const rectW = 150;
  const rectH = 36;

  // Arrow marker
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', 'arrow');
  marker.setAttribute('viewBox', '0 0 10 10');
  marker.setAttribute('refX', '10');
  marker.setAttribute('refY', '5');
  marker.setAttribute('markerWidth', '6');
  marker.setAttribute('markerHeight', '6');
  marker.setAttribute('orient', 'auto-start-reverse');
  const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  arrowPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
  arrowPath.setAttribute('fill', 'var(--text-muted)');
  marker.appendChild(arrowPath);
  defs.appendChild(marker);
  svg.appendChild(defs);

  // Edges
  states.forEach(state => {
    if (!layout[state]) layout[state] = { x: 300, y: 200 };
    const p1 = layout[state];
    (workflowDef.states[state].transitions || []).forEach(target => {
      const p2 = layout[target] || { x: 300, y: 200 };
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', p1.x);
      line.setAttribute('y1', p1.y + rectH / 2);
      line.setAttribute('x2', p2.x);
      line.setAttribute('y2', p2.y - rectH / 2);
      const isRejectEdge = target.includes('REJECTED');
      line.setAttribute('stroke', isRejectEdge ? 'var(--state-rejected)' : 'var(--text-muted)');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('stroke-dasharray', isRejectEdge ? '5,3' : '0');
      line.setAttribute('marker-end', 'url(#arrow)');
      svg.appendChild(line);
    });
  });

  // Nodes
  states.forEach(state => {
    if (!layout[state]) return;
    const p = layout[state];
    const isCurrent = state === activeState;
    const def = workflowDef.states[state];

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', p.x - rectW / 2);
    rect.setAttribute('y', p.y - rectH / 2);
    rect.setAttribute('width', rectW);
    rect.setAttribute('height', rectH);
    rect.setAttribute('rx', '7');

    let fill = '#1e293b';
    let stroke = 'rgba(255,255,255,0.15)';

    if (isCurrent) {
      fill = 'var(--highlight)';
      stroke = '#fff';
    } else if (def.terminal) {
      if (state.includes('REJECTED')) fill = 'rgba(239, 68, 68, 0.3)';
      else fill = 'rgba(16, 185, 129, 0.3)';
    }

    rect.setAttribute('fill', fill);
    rect.setAttribute('stroke', stroke);
    rect.setAttribute('stroke-width', isCurrent ? '2' : '1');
    g.appendChild(rect);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', p.x);
    text.setAttribute('y', p.y + 5);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', isCurrent ? '#fff' : 'var(--text-main)');
    text.setAttribute('font-size', '9px');
    text.setAttribute('font-family', 'Inter, sans-serif');
    text.setAttribute('font-weight', isCurrent ? '700' : '400');
    text.textContent = state.replace(/_/g, ' ');
    g.appendChild(text);

    svg.appendChild(g);
  });
}

// Execute
init();
