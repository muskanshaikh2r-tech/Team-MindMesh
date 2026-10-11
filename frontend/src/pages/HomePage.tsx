import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  Cpu,
  Mic,
  DollarSign,
  Zap,
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Play
} from 'lucide-react';
import { DemoScenario, DashboardMetrics, ModelConfig } from '../types';
import { fetchScenarios, fetchDashboard } from '../services/api';

interface HomePageProps {
  onSelectScenario: (scenario: DemoScenario) => void;
  onGoToAsk: (initialPrompt?: string) => void;
  models: ModelConfig[];
}

export const HomePage: React.FC<HomePageProps> = ({ onSelectScenario, onGoToAsk, models }) => {
  const [scenarios, setScenarios] = useState<DemoScenario[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [quickPrompt, setQuickPrompt] = useState('');

  useEffect(() => {
    fetchScenarios().then(setScenarios).catch(console.error);
    fetchDashboard().then(setMetrics).catch(console.error);
  }, []);

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickPrompt.trim()) {
      onGoToAsk(quickPrompt.trim());
    } else {
      onGoToAsk();
    }
  };

  return (
    <div className="space-y-10 pb-12">
      {/* Hero Section (Matching Screen 1) */}
      <div className="relative rounded-3xl p-8 md:p-12 overflow-hidden border border-cyan-500/25 bg-gradient-to-br from-space-900 via-space-950 to-space-900 shadow-glass">
        {/* Decorative background glows */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs font-medium text-cyan-300">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>VORTEXA 3.0 × ElevenLabs</span>
              <span className="text-slate-500">|</span>
              <span className="text-purple-300">AI Systems & Infrastructure</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
                One Question.<br />
                <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                  The Right AI Model.
                </span>
              </h1>
              <p className="text-base md:text-lg text-slate-300 max-w-xl font-normal leading-relaxed">
                Smart routing based on cost, speed, quality, and context. With transparent explanations,
                safe failover, and voice explanations — because your ideas deserve precision.
              </p>
            </div>

            {/* Quick Prompt Input */}
            <form onSubmit={handleQuickSubmit} className="pt-2">
              <div className="relative flex items-center max-w-xl rounded-2xl bg-space-850/90 border border-cyan-500/30 p-2 shadow-glow-cyan focus-within:border-cyan-400 transition-all">
                <input
                  type="text"
                  value={quickPrompt}
                  onChange={(e) => setQuickPrompt(e.target.value)}
                  placeholder="Speak or type your question..."
                  className="w-full bg-transparent px-4 py-2.5 text-sm md:text-base text-white placeholder-slate-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-space-950 font-bold flex items-center justify-center transition-all shadow-md"
                >
                  <ArrowRight className="w-5 h-5 text-space-950" />
                </button>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => onGoToAsk()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-space-800/80 hover:bg-space-800 text-xs font-medium text-cyan-300 border border-cyan-500/25 transition-all"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Use Voice</span>
                </button>
                <button
                  type="button"
                  onClick={() => onGoToAsk('Explain pointers in C++ with examples')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-space-800/60 hover:bg-space-800 text-xs text-slate-300 border border-slate-700/60 transition-all"
                >
                  <span>Example: C++ Pointers</span>
                </button>
              </div>
            </form>
          </div>

          {/* Futuristic Visual Hero Graphic (Matching Screen 1 Brain/Chips) */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-sm aspect-square flex items-center justify-center">
              {/* Radial rings */}
              <div className="absolute inset-0 rounded-full border border-cyan-500/20 animate-pulse-subtle" />
              <div className="absolute inset-8 rounded-full border border-blue-500/30" />
              <div className="absolute inset-16 rounded-full border border-purple-500/20" />

              {/* Central Glowing Pod */}
              <div className="relative z-10 w-44 h-44 rounded-3xl bg-gradient-to-b from-space-800 to-space-900 border-2 border-cyan-400/40 shadow-glow-cyan flex flex-col items-center justify-center p-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center mb-2">
                  <Cpu className="w-8 h-8 text-cyan-300" />
                </div>
                <div className="text-xs font-bold text-white uppercase tracking-wider">Router Engine</div>
                <div className="text-[10px] text-cyan-400 font-mono mt-0.5">Filter → Rank → Try</div>
              </div>

              {/* Orbiting Model Badges */}
              <div className="absolute top-2 left-4 px-3 py-1.5 rounded-xl bg-space-850/90 border border-purple-500/40 text-[11px] font-medium text-purple-300 shadow-glass flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <span>Large (Opus Tier)</span>
              </div>
              <div className="absolute bottom-4 left-2 px-3 py-1.5 rounded-xl bg-space-850/90 border border-blue-500/40 text-[11px] font-medium text-blue-300 shadow-glass flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span>Medium (Sonnet Tier)</span>
              </div>
              <div className="absolute top-10 right-0 px-3 py-1.5 rounded-xl bg-space-850/90 border border-cyan-500/40 text-[11px] font-medium text-cyan-300 shadow-glass flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span>Mini (Flash Tier)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Value Proposition Pills Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-10 border-t border-slate-800/80 mt-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200">Smart Routing</div>
              <div className="text-[11px] text-slate-400">Offline signal complexity</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200">Transparent Choice</div>
              <div className="text-[11px] text-slate-400">Every rejection reason shown</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200">Cost & Speed</div>
              <div className="text-[11px] text-slate-400">Savings vs large frontier</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200">Safe Failover</div>
              <div className="text-[11px] text-slate-400">Never relax constraints</div>
            </div>
          </div>
        </div>
      </div>

      {/* Live System Metrics Quick Strip */}
      {metrics && metrics.total_requests > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl glass-panel">
            <div className="text-xs text-slate-400 font-medium">Total Routed</div>
            <div className="text-2xl font-bold text-white mt-1">{metrics.total_requests}</div>
            <div className="text-[11px] text-cyan-400 mt-0.5">{metrics.success_rate_percent}% success rate</div>
          </div>
          <div className="p-4 rounded-2xl glass-panel">
            <div className="text-xs text-slate-400 font-medium">Average Latency</div>
            <div className="text-2xl font-bold text-white mt-1">{metrics.avg_latency_ms} ms</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Observed runtime</div>
          </div>
          <div className="p-4 rounded-2xl glass-panel">
            <div className="text-xs text-slate-400 font-medium">Total Cost</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">${metrics.total_estimated_cost.toFixed(5)}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Simulated billing</div>
          </div>
          <div className="p-4 rounded-2xl glass-panel">
            <div className="text-xs text-slate-400 font-medium">Cost Savings vs Large</div>
            <div className="text-2xl font-bold text-purple-300 mt-1">{metrics.savings_percent}%</div>
            <div className="text-[11px] text-purple-400 mt-0.5">${metrics.total_savings_vs_large.toFixed(4)} saved</div>
          </div>
        </div>
      )}

      {/* 7 Official Hackathon Demo Scenarios */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Play className="w-5 h-5 text-cyan-400" />
              <span>Official Judge Demo Scenarios</span>
            </h2>
            <p className="text-xs text-slate-400">
              Section 3.2: 7 test scenarios verifying correctness, failover, constraint rigidity, and uncertainty handling.
            </p>
          </div>
          <div className="text-xs text-slate-500 font-mono">1-Click Live Testability</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenarios.map((sc) => (
            <div
              key={sc.id}
              className="p-5 rounded-2xl glass-panel glass-card-hover flex flex-col justify-between space-y-4 border border-slate-800"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    Scenario #{sc.id}
                  </span>
                  {sc.max_latency_ms && (
                    <span className="text-[11px] text-slate-400 font-mono">
                      ≤ {sc.max_latency_ms}ms
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-100">{sc.title.split(': ')[1] || sc.title}</h3>
                <p className="text-xs text-slate-400 line-clamp-2">{sc.description}</p>
                <div className="p-2.5 rounded-xl bg-space-950/70 border border-slate-800/80 text-[11px] text-slate-300 font-mono truncate">
                  "{sc.prompt}"
                </div>
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300">
                  <strong className="text-blue-200">Expected:</strong> {sc.expected_behavior}
                </div>
              </div>

              <button
                onClick={() => onSelectScenario(sc)}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 hover:from-cyan-500/30 hover:to-purple-500/30 text-cyan-300 hover:text-white border border-cyan-500/30 font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <span>Run Scenario #{sc.id}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
