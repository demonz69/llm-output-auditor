import { useState } from 'react';

const RUN_OPTIONS = [3, 5, 7, 10];

const SAMPLE_PROMPTS = {
  prompt: 'Explain the difference between TCP and UDP protocols. Include at least 3 key differences.',
  system_prompt: 'You are a senior network engineer. Provide concise, technically accurate answers. Use bullet points where appropriate.',
  ground_truth:
    'TCP is connection-oriented while UDP is connectionless. TCP provides reliable ordered delivery with error checking and retransmission. UDP is faster with lower latency because it has no handshake or acknowledgment overhead. TCP uses flow control and congestion control mechanisms. UDP does not guarantee packet delivery or ordering.',
};

export default function SetupTab({ onRun, isRunning }) {
  const [prompt, setPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [groundTruth, setGroundTruth] = useState('');
  const [runs, setRuns] = useState(5);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    onRun({ prompt, system_prompt: systemPrompt, ground_truth: groundTruth, runs });
  };

  const loadSample = () => {
    setPrompt(SAMPLE_PROMPTS.prompt);
    setSystemPrompt(SAMPLE_PROMPTS.system_prompt);
    setGroundTruth(SAMPLE_PROMPTS.ground_truth);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-200 tracking-wide">AUDIT CONFIGURATION</h2>
          <p className="text-[10px] text-terminal-muted mt-0.5">
            Configure your prompt, reference data, and run parameters
          </p>
        </div>
        <button type="button" onClick={loadSample} className="btn-secondary text-[10px]">
          Load Sample
        </button>
      </div>

      <div className="border border-terminal-border bg-terminal-surface p-4 space-y-4">
        {/* User Prompt */}
        <div>
          <label className="block text-[10px] text-terminal-muted uppercase tracking-wider mb-1.5" htmlFor="input-prompt">
            User Prompt <span className="text-terminal-red">*</span>
          </label>
          <textarea
            id="input-prompt"
            className="input-field"
            rows={4}
            placeholder="Enter the prompt to stress-test..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
          />
        </div>

        {/* System Prompt */}
        <div>
          <label className="block text-[10px] text-terminal-muted uppercase tracking-wider mb-1.5" htmlFor="input-system-prompt">
            System Prompt <span className="text-gray-600">(optional)</span>
          </label>
          <textarea
            id="input-system-prompt"
            className="input-field"
            rows={3}
            placeholder="System instructions for the model..."
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
          />
        </div>

        {/* Ground Truth */}
        <div>
          <label className="block text-[10px] text-terminal-muted uppercase tracking-wider mb-1.5" htmlFor="input-ground-truth">
            Ground Truth <span className="text-gray-600">(for hallucination detection)</span>
          </label>
          <textarea
            id="input-ground-truth"
            className="input-field"
            rows={3}
            placeholder="Reference facts to check LLM responses against..."
            value={groundTruth}
            onChange={(e) => setGroundTruth(e.target.value)}
          />
          <p className="text-[10px] text-terminal-muted mt-1">
            Key claims from this text are extracted and matched against each response to compute hallucination risk.
          </p>
        </div>
      </div>

      {/* Run Count + CTA */}
      <div className="border border-terminal-border bg-terminal-surface p-4">
        <div className="flex items-end justify-between gap-6">
          <div>
            <label className="block text-[10px] text-terminal-muted uppercase tracking-wider mb-2">
              Run Count
            </label>
            <div className="flex gap-1.5">
              {RUN_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  id={`run-count-${n}`}
                  onClick={() => setRuns(n)}
                  className={`px-3 py-1.5 text-xs border transition-all duration-150 ${
                    runs === n
                      ? 'border-terminal-cyan bg-terminal-cyan/10 text-terminal-cyan'
                      : 'border-terminal-border text-terminal-muted hover:border-gray-500 hover:text-gray-300'
                  }`}
                >
                  {n}×
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            id="btn-run-audit"
            disabled={isRunning || !prompt.trim()}
            className="btn-primary flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-gray-950 border-t-transparent rounded-full animate-spin" />
                Running...
              </>
            ) : (
              <>
                <span className="text-base leading-none">▶</span>
                Run Audit
              </>
            )}
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="border border-terminal-border/50 p-3 text-[10px] text-terminal-muted leading-relaxed">
        <span className="text-terminal-cyan mr-1">ℹ</span>
        Each run calls <span className="text-gray-300">claude-sonnet-4-20250514</span> with a 600ms gap.
        Responses are scored for pairwise consistency (TF-IDF cosine similarity) and hallucination risk
        (keyword coverage against ground truth). Results stream in real-time.
      </div>
    </form>
  );
}
