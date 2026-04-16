# ⚙️ Workflow Engine

A robust, production-grade workflow engine that leverages **Express**, **MongoDB**, **Node.js**, **Shell Scripts**, **Git**, and **Unix Signals** to define, persist, execute, and recover stateful workflows as finite state machines.

---

## 📌 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Workflow Definition](#workflow-definition)
- [State Transitions](#state-transitions)
- [Shell Script Actions](#shell-script-actions)
- [MongoDB Persistence](#mongodb-persistence)
- [Git-Tracked Definitions](#git-tracked-definitions)
- [Unix Signal Handling](#unix-signal-handling)
- [Timeout & Error Recovery](#timeout--error-recovery)
- [API Reference](#api-reference)
- [Environment Variables](#environment-variables)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

The Workflow Engine allows you to model complex business processes as **finite state machines (FSMs)**. Each workflow moves through a series of defined states, with transitions validated by Node.js logic, side effects executed via shell scripts, state persisted in MongoDB, definitions versioned in Git, and long-running workflows interruptible via Unix signals.

**Core capabilities:**

- Define state machines declaratively via Express routes
- Persist workflow execution state atomically in MongoDB
- Validate and guard state transitions in Node.js middleware
- Trigger shell script side effects on state entry/exit
- Version-control workflow definitions via Git
- Interrupt or pause running workflows using SIGTERM / SIGINT / SIGUSR1
- Recover from failures using timeouts and compensating transactions

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client / Caller                       │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP Request
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   Express Route Layer                        │
│         (State machine definitions & transition API)        │
└────────────┬──────────────────────────────┬─────────────────┘
             │                              │
             ▼                              ▼
┌────────────────────────┐    ┌─────────────────────────────┐
│  Node.js Transition     │    │   MongoDB Persistence Layer │
│  Validator & Executor   │◄──►│   (Workflow execution state)│
└────────────┬───────────┘    └─────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│              Shell Script Action Runner                      │
│     (Side effects: notifications, file ops, API calls)      │
└─────────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                Git-Versioned Definition Store                │
│          (Workflow YAML/JSON definitions in repo)           │
└─────────────────────────────────────────────────────────────┘

  Unix Signals ──► Interrupt / Pause / Resume running workflows
  Timeout Engine ──► Detect stale states → trigger compensations
```

---

## Tech Stack

| Layer | Technology | Role |
|---|---|---|
| API | Express.js | Route definitions, transition endpoints |
| Runtime | Node.js | Validation, orchestration, signal handling |
| Persistence | MongoDB | Workflow state storage |
| Side Effects | Bash / Shell Scripts | Actions per state |
| Version Control | Git | Workflow definition history |
| Process Control | Unix Signals | Workflow interruption |
| Recovery | Node.js + MongoDB | Timeouts, compensating actions |

---

## Project Structure

```
workflow-engine/
├── src/
│   ├── routes/
│   │   ├── workflow.routes.js        # Express routes = state machine definitions
│   │   └── admin.routes.js           # Admin: history, rollback, status
│   ├── engine/
│   │   ├── stateValidator.js         # Validates allowed transitions
│   │   ├── transitionExecutor.js     # Executes transitions + actions
│   │   ├── timeoutManager.js         # Polls for stale workflows
│   │   └── compensationHandler.js    # Compensating actions on failure
│   ├── actions/
│   │   └── runner.js                 # Spawns shell scripts as child processes
│   ├── persistence/
│   │   └── workflowStore.js          # MongoDB read/write for workflow state
│   ├── signals/
│   │   └── signalHandler.js          # SIGTERM, SIGINT, SIGUSR1/2 handlers
│   ├── git/
│   │   └── definitionManager.js      # Git commit/checkout for definitions
│   └── app.js                        # Express app bootstrap
├── definitions/
│   ├── order-workflow.yaml           # Example: order processing FSM
│   └── onboarding-workflow.yaml      # Example: user onboarding FSM
├── scripts/
│   ├── actions/
│   │   ├── on_payment_received.sh
│   │   ├── on_order_shipped.sh
│   │   ├── on_order_cancelled.sh
│   │   └── compensate_payment.sh     # Compensating action
│   └── health_check.sh
├── tests/
│   ├── unit/
│   └── integration/
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js >= 18.x
- MongoDB >= 6.x
- Git >= 2.x
- Bash (Unix/macOS/WSL)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/workflow-engine.git
cd workflow-engine

# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env

# Start MongoDB (if running locally)
mongod --dbpath ./data/db

# Start the engine
npm start
```

### Development Mode

```bash
npm run dev      # nodemon with hot reload
```

---

## Workflow Definition

Workflows are defined as YAML files inside the `definitions/` directory and version-controlled by Git. Each definition specifies states, allowed transitions, timeout durations, and associated shell script actions.

```yaml
# definitions/order-workflow.yaml
name: order-processing
version: "1.0.0"
initial: pending

states:
  pending:
    on:
      PAYMENT_RECEIVED:
        target: processing
        action: scripts/actions/on_payment_received.sh
    timeout:
      duration: 3600          # seconds
      target: cancelled
      action: scripts/actions/compensate_payment.sh

  processing:
    on:
      SHIPPED:
        target: shipped
        action: scripts/actions/on_order_shipped.sh
      FAILED:
        target: failed
        action: scripts/actions/compensate_payment.sh
    timeout:
      duration: 86400
      target: failed

  shipped:
    on:
      DELIVERED:
        target: completed
    timeout:
      duration: 604800
      target: returned

  completed:
    type: final

  cancelled:
    type: final

  failed:
    type: final
    compensation: scripts/actions/compensate_payment.sh
```

---

## State Transitions

Express routes expose the transition API. Each route corresponds to a workflow event and triggers the state machine logic in the engine.

```js
// src/routes/workflow.routes.js
router.post('/:workflowId/transition', async (req, res) => {
  const { workflowId } = req.params;
  const { event, payload } = req.body;

  // 1. Load current state from MongoDB
  const workflow = await workflowStore.findById(workflowId);

  // 2. Validate transition is allowed
  const isValid = stateValidator.validate(workflow.definition, workflow.currentState, event);
  if (!isValid) return res.status(400).json({ error: 'Invalid transition' });

  // 3. Execute transition: persist new state + run shell action
  const result = await transitionExecutor.execute(workflow, event, payload);

  res.json({ success: true, newState: result.currentState });
});
```

---

## Shell Script Actions

For every state entry or transition, the engine spawns the associated shell script as a child process. Scripts receive workflow context via environment variables.

```bash
# scripts/actions/on_payment_received.sh
#!/usr/bin/env bash
set -euo pipefail

echo "Processing payment for order: $WORKFLOW_ID"
echo "Payload: $TRANSITION_PAYLOAD"

# Call external payment API, send notifications, update inventory...
curl -s -X POST "$PAYMENT_SERVICE_URL/confirm" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\": \"$WORKFLOW_ID\"}"

exit 0
```

```js
// src/actions/runner.js
const { spawn } = require('child_process');

function runAction(scriptPath, workflow) {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [scriptPath], {
      env: {
        ...process.env,
        WORKFLOW_ID: workflow.id,
        CURRENT_STATE: workflow.currentState,
        TRANSITION_PAYLOAD: JSON.stringify(workflow.lastPayload),
      },
      timeout: 30000,   // 30 second hard limit per script
    });

    child.on('close', code => code === 0 ? resolve() : reject(new Error(`Action failed: ${code}`)));
  });
}
```

---

## MongoDB Persistence

All workflow execution state is stored atomically in MongoDB. Each document holds the full workflow context, history, and metadata.

```json
{
  "_id": "wf_abc123",
  "definitionName": "order-processing",
  "definitionVersion": "1.0.0",
  "currentState": "processing",
  "status": "active",
  "startedAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:05:23Z",
  "timeoutAt": "2024-01-16T10:05:23Z",
  "context": {
    "orderId": "ORD-9876",
    "customerId": "CUST-001"
  },
  "history": [
    { "from": "pending", "to": "processing", "event": "PAYMENT_RECEIVED", "at": "2024-01-15T10:05:23Z" }
  ]
}
```

---

## Git-Tracked Definitions

Workflow definitions are committed to Git on every create or update. This provides a full audit trail, rollback capability, and diff-based change management.

```js
// src/git/definitionManager.js
async function saveDefinition(name, content) {
  const filePath = `definitions/${name}.yaml`;
  fs.writeFileSync(filePath, content);

  execSync(`git add ${filePath}`);
  execSync(`git commit -m "chore: update workflow definition '${name}'"`);
}

async function rollbackDefinition(name, commitHash) {
  execSync(`git checkout ${commitHash} -- definitions/${name}.yaml`);
}
```

---

## Unix Signal Handling

The engine listens for Unix signals to enable graceful interruption, pause, and resume of running workflows.

| Signal | Behavior |
|---|---|
| `SIGTERM` | Graceful shutdown — complete current transition, persist state, exit |
| `SIGINT` | Immediate stop — mark active workflows as `interrupted` in MongoDB |
| `SIGUSR1` | Pause all active workflows — set status to `paused` |
| `SIGUSR2` | Resume all paused workflows |

```js
// src/signals/signalHandler.js
process.on('SIGTERM', async () => {
  console.log('SIGTERM received — draining active transitions...');
  await workflowStore.flushPendingStates();
  process.exit(0);
});

process.on('SIGUSR1', async () => {
  console.log('SIGUSR1 — pausing all active workflows');
  await workflowStore.updateStatus('active', 'paused');
});

process.on('SIGUSR2', async () => {
  console.log('SIGUSR2 — resuming paused workflows');
  await workflowStore.updateStatus('paused', 'active');
});
```

---

## Timeout & Error Recovery

A background polling job detects workflows that have exceeded their timeout duration. On timeout, the engine transitions the workflow to the configured fallback state and optionally runs a **compensating action** to undo side effects.

```js
// src/engine/timeoutManager.js
setInterval(async () => {
  const staleWorkflows = await workflowStore.findTimedOut();

  for (const workflow of staleWorkflows) {
    const timeoutConfig = getTimeoutConfig(workflow.definition, workflow.currentState);

    console.warn(`Workflow ${workflow.id} timed out in state '${workflow.currentState}'`);

    if (timeoutConfig.action) {
      await actionRunner.runAction(timeoutConfig.action, workflow);
    }

    await transitionExecutor.forceTransition(workflow, timeoutConfig.target, 'TIMEOUT');
  }
}, 60_000); // Poll every 60 seconds
```

**Compensating actions** are idempotent shell scripts that reverse the effects of a failed or timed-out state (e.g., refunding a payment, releasing a lock, rolling back a database change).

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/workflows` | Create a new workflow instance |
| `GET` | `/workflows/:id` | Get current state and context |
| `POST` | `/workflows/:id/transition` | Send an event to trigger a transition |
| `GET` | `/workflows/:id/history` | Get full transition history |
| `POST` | `/workflows/:id/pause` | Pause a running workflow |
| `POST` | `/workflows/:id/resume` | Resume a paused workflow |
| `POST` | `/workflows/:id/cancel` | Cancel a workflow (triggers compensation) |
| `GET` | `/definitions` | List all workflow definitions |
| `POST` | `/definitions` | Create or update a definition (commits to Git) |
| `GET` | `/definitions/:name/history` | Get Git commit log for a definition |

---

## Environment Variables

```env
# .env.example

# Server
PORT=3000
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb://localhost:27017/workflow-engine

# Git
GIT_DEFINITIONS_DIR=./definitions
GIT_AUTHOR_NAME=Workflow Engine
GIT_AUTHOR_EMAIL=engine@yourorg.com

# Actions
ACTION_TIMEOUT_MS=30000
SHELL_INTERPRETER=/usr/bin/env bash

# Timeouts
TIMEOUT_POLL_INTERVAL_MS=60000

# External Services (used by shell scripts)
PAYMENT_SERVICE_URL=https://api.payment.example.com
NOTIFICATION_SERVICE_URL=https://api.notify.example.com
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

Please ensure all new workflow definitions are accompanied by integration tests, and all shell scripts handle errors with `set -euo pipefail`.

---

## License

MIT License — see [LICENSE](./LICENSE) for details.
