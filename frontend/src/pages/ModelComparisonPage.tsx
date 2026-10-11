import React from 'react';
import {
  Scale,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Zap,
  DollarSign,
  Clock,
  Layers,
  Award
} from 'lucide-react';
import { ModelConfig, RouteResponse } from '../types';

interface ModelComparisonPageProps {
  models: ModelConfig[];
  lastResponse: RouteResponse | null;
  onGoToFlow: () => void;
}

export const ModelComparisonPage: React.FC<ModelComparisonPageProps> = ({
  models,
  lastResponse,
  onGoToFlow
}) => {
  const winnerId = lastResponse?.selected_model_id;

  return (
    <div className="space-y-8 pb-12">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Scale className="w-6 h-6 text-cyan-400" />
          <span>Model Comparison & Selection Matrix</span>
        </h1>
        <p className="text-xs text-slate-400">
          Compare specifications across all models and review why the winner was chosen for the current request.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Comparison Matrix Table */}
        <div className="lg:col-span-8 p-6 rounded-3xl glass-panel space-y-5 border border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-200">Catalogue Specifications</h2>
            <span className="text-[11px] text-slate-500 font-mono">Simulated Endpoints</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 text-slate-400 font-mono text-[11px]">
                  <th className="py-3 px-3">Criteria</th>
                  {models.map((m) => (
                    <th key={m.id} className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white">{m.name}</span>
                        {m.id === winnerId && (
                          <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-bold">
                            WINNER
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {/* Capability */}
                <tr>
                  <td className="py-3 px-3 font-sans font-medium text-slate-300 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-purple-400" /> Capability Tier
                  </td>
                  {models.map((m) => (
                    <td key={m.id} className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        m.capability >= 4 ? 'bg-purple-500/10 text-purple-300' :
                        m.capability >= 3 ? 'bg-blue-500/10 text-blue-300' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        Level {m.capability}/5
                      </span>
                    </td>
                  ))}
                </tr>

                {/* Cost per 1K */}
                <tr>
                  <td className="py-3 px-3 font-sans font-medium text-slate-300 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Cost / 1k Tokens
                  </td>
                  {models.map((m) => (
                    <td key={m.id} className="py-3 px-3 text-emerald-300 font-semibold">
                      ${m.cost_per_1k.toFixed(4)}
                    </td>
                  ))}
                </tr>

                {/* Expected Latency */}
                <tr>
                  <td className="py-3 px-3 font-sans font-medium text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" /> Expected Latency
                  </td>
                  {models.map((m) => (
                    <td key={m.id} className="py-3 px-3 text-cyan-300">
                      {m.latency_ms} ms
                    </td>
                  ))}
                </tr>

                {/* Context Window */}
                <tr>
                  <td className="py-3 px-3 font-sans font-medium text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-400" /> Context Window
                  </td>
                  {models.map((m) => (
                    <td key={m.id} className="py-3 px-3 text-slate-300">
                      {(m.context_window / 1024).toFixed(0)}k tokens
                    </td>
                  ))}
                </tr>

                {/* Availability */}
                <tr>
                  <td className="py-3 px-3 font-sans font-medium text-slate-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" /> Status
                  </td>
                  {models.map((m) => (
                    <td key={m.id} className="py-3 px-3">
                      {m.available ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Online
                        </span>
                      ) : (
                        <span className="text-rose-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Offline
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Dynamic Decision Rationale Card (Matching Screen 4 right panel) */}
        <div className="lg:col-span-4 p-6 rounded-3xl glass-panel space-y-5 border border-cyan-500/25">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Decision Breakdown</span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {lastResponse ? `Based on query: "${lastResponse.prompt.slice(0, 40)}..."` : 'Run a query to evaluate'}
            </p>
          </div>

          {lastResponse ? (
            <div className="space-y-4">
              {/* Why winner won */}
              <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 space-y-2">
                <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  <span>Why {lastResponse.selected_model_name || 'Candidate'} won:</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {lastResponse.winning_reason || 'Met every constraint and topped deterministic sorting.'}
                </p>
              </div>

              {/* Why others were not selected */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-rose-400" />
                  <span>Why others were excluded:</span>
                </div>
                <div className="space-y-2">
                  {lastResponse.all_evaluations
                    .filter((ev) => ev.model_id !== winnerId)
                    .map((ev) => (
                      <div
                        key={ev.model_id}
                        className="p-3 rounded-xl bg-space-950/70 border border-slate-800 text-[11px] space-y-1"
                      >
                        <div className="font-semibold text-slate-200">{ev.model_name}</div>
                        {ev.rejection_reasons.length > 0 ? (
                          <div className="text-rose-300 font-mono">
                            {ev.rejection_reasons[0]}
                          </div>
                        ) : (
                          <div className="text-slate-400 font-mono">
                            Valid, but ranked #{ev.rank} by preference.
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              <button
                onClick={onGoToFlow}
                className="w-full py-2.5 rounded-xl bg-space-850 hover:bg-space-800 border border-cyan-500/30 text-xs font-semibold text-cyan-300 flex items-center justify-center gap-2 transition-all"
              >
                <span>View Full Pipeline Trace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="text-xs text-slate-400 text-center py-8">
              No recent request. Submit a prompt in the Ask tab to generate this analysis.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
