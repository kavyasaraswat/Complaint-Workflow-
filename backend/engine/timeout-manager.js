// We can use native fetch available in Node.js 18+
class TimeoutManager {
  constructor() {
    this.timeouts = new Map();
    this.isPaused = false;
    this.apiPort = process.env.PORT || 3000;
  }

  schedule(complaintId, targetDate, toState) {
    if (this.timeouts.has(complaintId.toString())) {
      clearTimeout(this.timeouts.get(complaintId.toString()).timer);
    }

    const now = Date.now();
    const delay = new Date(targetDate).getTime() - now;

    if (delay <= 0) {
      if (!this.isPaused) this._triggerTransition(complaintId, toState);
      return;
    }

    const timer = setTimeout(() => {
      if (!this.isPaused) {
        this._triggerTransition(complaintId, toState);
        this.timeouts.delete(complaintId.toString());
      }
    }, delay);

    this.timeouts.set(complaintId.toString(), { timer, targetDate, toState });
  }

  cancel(complaintId) {
    if (this.timeouts.has(complaintId.toString())) {
      clearTimeout(this.timeouts.get(complaintId.toString()).timer);
      this.timeouts.delete(complaintId.toString());
    }
  }

  pauseAll() {
    this.isPaused = true;
    for (const [id, data] of this.timeouts.entries()) {
      clearTimeout(data.timer);
    }
  }

  resumeAll() {
    this.isPaused = false;
    for (const [id, data] of this.timeouts.entries()) {
      this.schedule(id, data.targetDate, data.toState);
    }
  }

  async _triggerTransition(complaintId, toState) {
    try {
      const response = await fetch(`http://localhost:${this.apiPort}/api/complaints/${complaintId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toState, actor: "system:timeout", note: "Auto-escalated due to timeout." })
      });
      if (!response.ok) {
        console.error(`Timeout trigger failed for ${complaintId}:`, await response.text());
      }
    } catch (error) {
      console.error(`Failed to execute timeout for ${complaintId}`, error);
    }
  }
}

const timeoutManager = new TimeoutManager();
module.exports = timeoutManager;
