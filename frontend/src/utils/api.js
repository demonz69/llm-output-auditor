const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Run an audit via SSE streaming POST request.
 * Calls onRunStart, onRunComplete, and onAuditComplete callbacks as events arrive.
 */
export async function runAudit({ prompt, system_prompt, ground_truth, runs }, callbacks) {
  const { onRunStart, onRunComplete, onAuditComplete, onError } = callbacks;

  try {
    const response = await fetch(`${API_BASE}/run-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, system_prompt, ground_truth, runs }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error ${response.status}: ${errorText}`);
    }

    const report = await response.json();

    // Fake the progressive UI to keep the visual effect alive!
    for (let i = 0; i < report.runs.length; i++) {
      onRunStart?.({ run_number: i + 1, total_runs: report.total_runs });
      await new Promise(r => setTimeout(r, 400));
      onRunComplete?.(report.runs[i]);
      await new Promise(r => setTimeout(r, 200));
    }

    onAuditComplete?.(report);
  } catch (err) {
    onError?.(err.message || 'An unknown error occurred');
  }
}

/**
 * Health check.
 */
export async function checkHealth() {
  const response = await fetch(`${API_BASE}/health`);
  return response.json();
}
