import { useState } from 'react';

export default function ReportTab({ report }) {
  const [expandedRun, setExpandedRun] = useState(null);

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-terminal-muted border border-dashed border-terminal-border">
        <span className="text-2xl mb-3 opacity-30">◈</span>
        <p className="text-xs tracking-wider">NO REPORT AVAILABLE</p>
        <p className="text-[10px] mt-1">Run an audit to generate results</p>
      </div>
    );
  }

  const exportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    const node = document.createElement('a');
    node.setAttribute("href", dataStr);
    node.setAttribute("download", `audit-report-${new Date().getTime()}.json`);
    document.body.appendChild(node);
    node.click();
    node.remove();
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-200 tracking-wide">AUDIT REPORT</h2>
          <p className="text-[10px] text-terminal-muted mt-0.5">Summary and per-run breakdown</p>
        </div>
        <button onClick={exportJSON} className="btn-secondary text-[10px] flex items-center gap-2">
          <span>↓</span> Export JSON
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="text-[10px] text-terminal-muted uppercase tracking-wider mb-2">Overall Grade</div>
          <div className={`text-2xl font-bold ${
            report.overall_grade === 'PASS' ? 'text-terminal-green' :
            report.overall_grade === 'WARN' ? 'text-terminal-amber' : 'text-terminal-red'
          }`}>
            {report.overall_grade}
          </div>
        </div>
        
        <div className="stat-card">
          <div className="text-[10px] text-terminal-muted uppercase tracking-wider mb-2">Consistency</div>
          <div className="text-2xl font-bold text-terminal-cyan">
            {report.consistency_score}%
          </div>
        </div>

        <div className="stat-card">
          <div className="text-[10px] text-terminal-muted uppercase tracking-wider mb-2">Errors</div>
          <div className={`text-2xl font-bold ${report.errors > 0 ? 'text-terminal-red' : 'text-gray-300'}`}>
            {report.errors} <span className="text-xs text-terminal-muted font-normal">/ {report.total_runs}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="text-[10px] text-terminal-muted uppercase tracking-wider mb-2">High Risk (Hallucination)</div>
          <div className={`text-2xl font-bold ${report.high_risk_runs > 0 ? 'text-terminal-amber' : 'text-gray-300'}`}>
            {report.high_risk_runs} <span className="text-xs text-terminal-muted font-normal">/ {report.successful_runs}</span>
          </div>
        </div>
      </div>

      {/* Consistency Progress Bar */}
      <div className="border border-terminal-border bg-terminal-surface p-4">
        <div className="flex justify-between text-[10px] text-terminal-muted mb-2 uppercase tracking-wider">
          <span>Consistency Score</span>
          <span>Target: >75% for PASS</span>
        </div>
        <div className="h-3 bg-terminal-bg border border-terminal-border relative">
          {/* Threshold markers */}
          <div className="absolute top-0 bottom-0 left-[50%] border-l border-dashed border-gray-600/50" title="50% Warn Threshold" />
          <div className="absolute top-0 bottom-0 left-[75%] border-l border-dashed border-gray-600/50" title="75% Pass Threshold" />
          
          <div 
            className="h-full bg-terminal-cyan/80 transition-all duration-1000"
            style={{ width: `${Math.max(0, Math.min(100, report.consistency_score))}%` }}
          />
        </div>
      </div>

      {/* Runs Table */}
      <div className="border border-terminal-border bg-terminal-surface">
        <div className="grid grid-cols-12 gap-4 p-3 border-b border-terminal-border text-[10px] text-terminal-muted uppercase tracking-wider font-semibold">
          <div className="col-span-1">Run</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Latency</div>
          <div className="col-span-2">Words</div>
          <div className="col-span-3">Hallucination Risk</div>
          <div className="col-span-2 text-right">Details</div>
        </div>
        
        <div className="divide-y divide-terminal-border">
          {report.runs.map((run) => (
            <div key={run.run_number} className="expand-row">
              <div 
                className="grid grid-cols-12 gap-4 p-3 text-xs items-center cursor-pointer"
                onClick={() => setExpandedRun(expandedRun === run.run_number ? null : run.run_number)}
              >
                <div className="col-span-1 font-mono text-terminal-muted">#{run.run_number}</div>
                <div className="col-span-2">
                  {run.status === 'success' 
                    ? <span className="text-terminal-green">Success</span>
                    : <span className="text-terminal-red">Error</span>}
                </div>
                <div className="col-span-2 text-gray-400">{run.latency_s}s</div>
                <div className="col-span-2 text-gray-400">{run.word_count}</div>
                <div className="col-span-3">
                  <span className={`badge badge-${run.hallucination_risk.toLowerCase()}`}>
                    {run.hallucination_risk}
                  </span>
                  {run.status === 'success' && run.keyword_coverage !== undefined && (
                    <span className="text-[10px] text-terminal-muted ml-2">
                      ({Math.round(run.keyword_coverage * 100)}% cov)
                    </span>
                  )}
                </div>
                <div className="col-span-2 text-right text-terminal-muted">
                  {expandedRun === run.run_number ? '▲' : '▼'}
                </div>
              </div>

              {/* Expanded details */}
              {expandedRun === run.run_number && (
                <div className="p-4 bg-terminal-bg/50 border-t border-terminal-border space-y-4">
                  {run.status === 'error' ? (
                    <div>
                      <div className="text-[10px] text-terminal-muted uppercase tracking-wider mb-1">Error Message</div>
                      <div className="p-2 border border-terminal-red/30 bg-red-950/20 text-terminal-red font-mono text-[11px] whitespace-pre-wrap">
                        {run.error}
                      </div>
                    </div>
                  ) : (
                    <>
                      {run.flagged_claims && run.flagged_claims.length > 0 && (
                        <div>
                          <div className="text-[10px] text-terminal-muted uppercase tracking-wider mb-1 text-terminal-amber">
                            Missing Key Claims
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {run.flagged_claims.map((claim, idx) => (
                              <span key={idx} className="px-1.5 py-0.5 border border-terminal-amber/30 bg-amber-950/30 text-terminal-amber text-[10px] font-mono">
                                {claim}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div>
                        <div className="text-[10px] text-terminal-muted uppercase tracking-wider mb-1">Response Preview</div>
                        <div className="p-3 border border-terminal-border bg-terminal-bg text-gray-300 font-mono text-[11px] whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                          {run.response}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Prompt summary */}
      <div className="p-4 border border-terminal-border bg-terminal-surface text-[10px] space-y-2">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-2 text-terminal-muted uppercase tracking-wider">Prompt</div>
          <div className="col-span-10 text-gray-400 font-mono">{report.prompt}</div>
        </div>
        {report.system_prompt && (
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-2 text-terminal-muted uppercase tracking-wider">System</div>
            <div className="col-span-10 text-gray-400 font-mono">{report.system_prompt}</div>
          </div>
        )}
        {report.ground_truth && (
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-2 text-terminal-muted uppercase tracking-wider">Ground Truth</div>
            <div className="col-span-10 text-gray-400 font-mono">{report.ground_truth}</div>
          </div>
        )}
      </div>
    </div>
  );
}
