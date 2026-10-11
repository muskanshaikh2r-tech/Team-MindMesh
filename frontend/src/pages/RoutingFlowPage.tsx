import React from 'react';
import {
  GitFork,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ShieldAlert,
  Sliders,
  Cpu,
  Layers,
  Sparkles,
  Zap
} from 'lucide-react';
import { RouteResponse, ModelConfig } from '../types';

interface RoutingFlowPageProps {
  lastResponse: RouteResponse | null;
  models: ModelConfig[];
  onGoToAsk: () => void;
}

export const RoutingFlowPage: React.FC<RoutingFlowPageProps> = ({
  lastResponse,
  models,
  onGoToAsk
}) => {
  return (
    <div className="space-y-8 pb-12">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <GitFork className="w-6 h-6 text-cyan-400" />
          <span>Deterministic Routing Pipeline Architecture</span>
        </h1>
        <p className="text-xs text-slate-400">
          Core principle: <strong>Filter → Rank → Try</strong>. A model breaking any hard constraint is permanently excluded.
        </p>
      </div>

      {/* 4 Architectural Stage Cards (Matching Screen 3) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            step: 1,
            title: 'Analyze',
            desc: 'Extract lexical & semantic signals, code patterns, and token counts.',
            color: 'from-cyan-500/20 to-blue-500/10',
            borderColor: 'border-cyan-500/30',
            badgeColor: 'bg-cyan-500 text-space-950'
          },
          {
            step: 2,
            title: 'Evaluate',
            desc: 'Determine minimum capability requirement. Round UP on uncertainty.',
            color: 'from-blue-500/20 to-purple-500/10',
            borderColor: 'border-blue-500/30',
            badgeColor: 'bg-blue-500 text-white'
          },
          {
            step: 3,
            title: 'Compare & Filter',
            desc: 'Filter models against latency, cost, quality & context. Record all rejections.',
            color: 'from-purple-500/20 to-pink-500/10',
            borderColor: 'border-purple-500/30',
            badgeColor: 'bg-purple-500 text-white'
          },
          {
            step: 4,
            title: 'Select & Failover',
            desc: 'Rank surviving candidates by preference. Try best, fail over safely.',
            color: 'from-emerald-500/20 to-cyan-500/10',
            borderColor: 'border-emerald-500/30',
            badgeColor: 'bg-emerald-400 text-space-950'
          },
        ].map((item) => (
          <div
            key={item.step}
            className={`p-5 rounded-3xl glass-panel border ${item.borderColor} space-y-3 relative overflow-hidden`}
          >
            <div className="flex items-center gap-3">
              <span className={`w-7 h-7 rounded-full ${item.badgeColor} font-bold text-xs flex items-center justify-center shrink-0 shadow-sm`}>
                {item.step}
              </span>
              <h3 className="font-bold text-sm text-white">{item.title}</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Live Visual Routing Flow Diagram (Matching Screen 3 lower half) */}
      {lastResponse ? (
        <div className="p-8 rounded-3xl glass-panel space-y-8 border border-cyan-500/30 shadow-glass">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-sm text-white">Live Request Routing Diagram</span>
              <span className="text-xs font-mono text-slate-500">[{lastResponse.request_id}]</span>
            </div>
            <div className="text-xs text-cyan-400 font-mono">
              Preference: {lastResponse.winning_reason?.split(' ')[0] || 'Lowest Cost'}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Box 1: Your Question */}
            <div className="lg:col-span-3 p-5 rounded-2xl bg-space-900/90 border border-slate-700/80 space-y-3">
              <div className="text-[11px] font-semibold uppercase text-cyan-400 font-mono flex items-center gap-1.5">
                <span>1. Prompt Query</span>
              </div>
              <p className="text-xs text-slate-200 line-clamp-3 font-mono bg-space-950 p-3 rounded-xl border border-slate-800">
                "{lastResponse.prompt}"
              </p>
              <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                <span>Tokens: {lastResponse.token_metrics.estimated_input_tokens}</span>
                <span className="text-purple-300 font-bold">Cap Req: {lastResponse.effective_min_capability}</span>
              </div>
            </div>

            <div className="lg:col-span-1 hidden lg:flex justify-center text-cyan-500">
              <ArrowRight className="w-6 h-6 animate-pulse" />
            </div>

            {/* Box 2: Candidate Models Pool */}
            <div className="lg:col-span-4 p-5 rounded-2xl bg-space-900/90 border border-slate-700/80 space-y-3">
              <div className="text-[11px] font-semibold uppercase text-blue-400 font-mono">
                2. Evaluated Models ({lastResponse.all_evaluations.length})
              </div>
              <div className="space-y-2">
                {lastResponse.all_evaluations.map((ev) => (
                  <div
                    key={ev.model_id}
                    className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                      ev.is_valid
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{ev.model_name}</span>
                      <span className="text-[10px] opacity-75 font-mono">({ev.expected_latency_ms}ms, Cap {ev.capability})</span>
                    </div>
                    <span>{ev.is_valid ? '✓ Passed' : '✗ Rejected'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-1 hidden lg:flex justify-center text-cyan-500">
              <ArrowRight className="w-6 h-6 animate-pulse" />
            </div>

            {/* Box 3: Decision Winner & Rejections */}
            <div className="lg:col-span-3 space-y-4">
              {/* Winner */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-space-900 border border-emerald-500/40 space-y-2 shadow-glow-cyan">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase text-emerald-400 font-mono">
                    Selected Model
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-base font-bold text-white">
                  {lastResponse.selected_model_name || 'None'}
                </div>
                <div className="text-[11px] text-emerald-300">
                  {lastResponse.winning_reason || lastResponse.message}
                </div>
              </div>

              {/* Rejection Summary Box */}
              <div className="p-4 rounded-2xl bg-space-950/90 border border-rose-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase text-rose-400 font-mono">
                    Excluded Models
                  </span>
                  <XCircle className="w-4 h-4 text-rose-400" />
                </div>
                <div className="text-[11px] text-slate-400">
                  {lastResponse.all_evaluations.filter(e => !e.is_valid).length} model(s) failed hard constraints.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 rounded-3xl glass-panel text-center space-y-3 border border-dashed border-slate-800">
          <p className="text-sm text-slate-300">
            No active routing request. Run a query in the playground to visualize the pipeline in action.
          </p>
          <button
            onClick={onGoToAsk}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-space-950 font-bold text-xs transition-all"
          >
            Open Playground
          </button>
        </div>
      )}
    </div>
  );
};
