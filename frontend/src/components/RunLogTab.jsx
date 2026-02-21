import { useEffect, useRef } from 'react';

export default function RunLogTab({ logs, progress, isRunning }) {
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-200 tracking-wide">RUN LOG</h2>
          <p className="text-[10px] text-terminal-muted mt-0.5">Real-time output from audit execution</p>
        </div>
        {progress.total > 0 && (
          <div className="text-[10px] text-terminal-muted">{progress.current}/{progress.total} runs completed</div>
        )}
      </div>

      {progress.total > 0 && (
        <div className="space-y-1">
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${pct}%`,
                backgroundColor: pct === 100 ? '#22c55e' : pct > 50 ? '#06b6d4' : '#f59e0b',
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-terminal-muted">
            <span>{pct}%</span>
            {isRunning && <span className="text-terminal-amber">Processing...</span>}
            {!isRunning && progress.current > 0 && <span className="text-terminal-green">Complete</span>}
          </div>
        </div>
      )}

      <div className="border border-terminal-border bg-terminal-bg">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-terminal-border bg-terminal-surface/50">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-terminal-red/60" />
            <span className="w-2 h-2 rounded-full bg-terminal-amber/60" />
            <span className="w-2 h-2 rounded-full bg-terminal-green/60" />
          </div>
          <span className="text-[9px] text-terminal-muted tracking-widest">audit-output — {logs.length} lines</span>
          <div className="w-12" />
        </div>

        <div className="h-[480px] overflow-y-auto p-0">
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-terminal-muted text-xs">
              <div className="text-center space-y-2">
                <div className="text-2xl opacity-30">▸</div>
                <p>No logs yet. Run an audit to see output here.</p>
              </div>
            </div>
          ) : (
            <div className="py-1">
              {logs.map((log) => (
                <div key={log.id} className={`log-line log-${log.type}`}>
                  <span className="text-terminal-muted mr-2 select-none">[{log.timestamp}]</span>
                  <span className={
                    log.type === 'success' ? 'text-terminal-green'
                    : log.type === 'error' ? 'text-terminal-red'
                    : log.type === 'warn' ? 'text-terminal-amber'
                    : 'text-gray-400'
                  }>
                    {log.message}
                  </span>
                </div>
              ))}
              {isRunning && (
                <div className="log-line log-info">
                  <span className="text-terminal-muted mr-2 select-none">
                    [{new Date().toLocaleTimeString('en-US', { hour12: false })}]
                  </span>
                  <span className="text-terminal-cyan cursor-blink">Awaiting response</span>
                </div>
              )}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
