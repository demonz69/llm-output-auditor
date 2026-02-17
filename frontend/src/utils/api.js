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

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;

        try {
          const event = JSON.parse(jsonStr);

          switch (event.type) {
            case 'run_start':
              onRunStart?.(event);
              break;
            case 'run_complete':
              onRunComplete?.(event.run);
              break;
            case 'audit_complete':
              onAuditComplete?.(event.report);
              break;
            default:
              break;
          }
        } catch (parseErr) {
          console.warn('Failed to parse SSE event:', parseErr);
        }
      }
    }
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
