import { useState, useCallback } from 'react';
import SetupTab from './components/SetupTab';
import RunLogTab from './components/RunLogTab';
import ReportTab from './components/ReportTab';
import { runAudit } from './utils/api';

const TABS = [
  { id: 'setup', label: 'Setup', icon: '⚙' },
  { id: 'log', label: 'Run Log', icon: '▸' },
  { id: 'report', label: 'Report', icon: '◈' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('setup');
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [report, setReport] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const addLog = useCallback((type, message) => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 });
    setLogs((prev) => [...prev, { type, message, timestamp: ts, id: Date.now() + Math.random() }]);
  }, []);

  const handleRunAudit = useCallback(
    async (config) => {
      setIsRunning(true);
      setLogs([]);
      setReport(null);
      setProgress({ current: 0, total: config.runs });
      setActiveTab('log');

      addLog('info', `── AUDIT INITIATED ──────────────────────────────────`);
      addLog('info', `Prompt: "${config.prompt.slice(0, 80)}${config.prompt.length > 80 ? '...' : ''}"`);
      addLog('info', `Model: llama-3.3-70b-versatile | Runs: ${config.runs}`);
      if (config.ground_truth) {
        addLog('info', `Ground truth provided (${config.ground_truth.split(' ').length} words)`);
      }
      addLog('info', `────────────────────────────────────────────────────`);

      await runAudit(config, {
        onRunStart: (event) => {
          addLog('info', `▸ Starting run ${event.run_number}/${event.total_runs}...`);
        },
        onRunComplete: (run) => {
          setProgress((p) => ({ ...p, current: run.run_number }));
          if (run.status === 'success') {
            addLog(
              'success',
              `✓ Run #${run.run_number} completed — ${run.word_count} words, ${run.latency_s}s latency`
            );
          } else {
            addLog('error', `✗ Run #${run.run_number} FAILED — ${run.error}`);
          }
        },
        onAuditComplete: (rpt) => {
          addLog('info', `────────────────────────────────────────────────────`);
          addLog(
            rpt.overall_grade === 'PASS' ? 'success' : rpt.overall_grade === 'WARN' ? 'warn' : 'error',
            `AUDIT COMPLETE — Grade: ${rpt.overall_grade} | Consistency: ${rpt.consistency_score}% | Errors: ${rpt.errors} | High-Risk: ${rpt.high_risk_runs}`
          );
          setReport(rpt);
          setIsRunning(false);
        },
        onError: (errMsg) => {
          addLog('error', `FATAL: ${errMsg}`);
          setIsRunning(false);
        },
      });
    },
    [addLog]
  );

  return (
    <div className="min-h-screen flex flex-col bg-terminal-bg">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="border-b border-terminal-border bg-terminal-surface scanline-effect">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border border-terminal-cyan flex items-center justify-center text-terminal-cyan text-sm font-bold">
              A
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-100 tracking-wide">
                LLM OUTPUT AUDITOR
              </h1>
              <p className="text-[10px] text-terminal-muted tracking-widest uppercase">
                Prompt stress-testing &amp; QA analysis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isRunning && (
              <div className="flex items-center gap-2 text-[10px] text-terminal-amber">
                <span className="inline-block w-1.5 h-1.5 bg-terminal-amber rounded-full animate-pulse" />
                RUNNING {progress.current}/{progress.total}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-[10px] text-terminal-muted">
              <span className="inline-block w-1.5 h-1.5 bg-terminal-green rounded-full" />
              v1.0.0
            </div>
          </div>
        </div>
      </header>

      {/* ── Tab Bar ─────────────────────────────────────────────── */}
      <nav className="border-b border-terminal-border bg-terminal-surface/50">
        <div className="max-w-7xl mx-auto px-4 flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            >
              <span className="mr-1.5 opacity-60">{tab.icon}</span>
              {tab.label}
              {tab.id === 'report' && report && (
                <span
                  className={`ml-2 inline-block w-1.5 h-1.5 rounded-full ${
                    report.overall_grade === 'PASS'
                      ? 'bg-terminal-green'
                      : report.overall_grade === 'WARN'
                      ? 'bg-terminal-amber'
                      : 'bg-terminal-red'
                  }`}
                />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Tab Content ─────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-5">
        {activeTab === 'setup' && (
          <SetupTab onRun={handleRunAudit} isRunning={isRunning} />
        )}
        {activeTab === 'log' && (
          <RunLogTab logs={logs} progress={progress} isRunning={isRunning} />
        )}
        {activeTab === 'report' && (
          <ReportTab report={report} />
        )}
      </main>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-terminal-border py-2 px-4 text-center text-[10px] text-terminal-muted tracking-wider">
        LLM OUTPUT AUDITOR — Built for AI QA workflows
      </footer>
    </div>
  );
}
