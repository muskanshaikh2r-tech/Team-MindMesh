import React, { useEffect, useState } from 'react';
import {
  History,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  ArrowRight,
  Filter,
  Copy,
  Check,
  RotateCcw,
  Clock,
  DollarSign,
  Layers,
  ChevronRight,
  X
} from 'lucide-react';
import { RequestHistoryItem, RouteResponse } from '../types';
import { fetchHistory } from '../services/api';

export const HistoryPage: React.FC = () => {
  const [history, setHistory] = useState<RequestHistoryItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [modelFilter, setModelFilter] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<RouteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const items = await fetchHistory(50, 0, statusFilter || undefined, modelFilter || undefined);
      setHistory(items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [statusFilter, modelFilter]);

  const copyJson = () => {
    if (!selectedItem) return;
    navigator.clipboard.writeText(JSON.stringify(selectedItem, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <History className="w-6 h-6 text-cyan-400" />
            <span>Persistent Request History & Audit Trail</span>
          </h1>
          <p className="text-xs text-slate-400">
            Every routing request is stored in SQLite with full constraint evaluations, tie-breaker rationales, and execution traces.
          </p>
        </div>

        <button
          onClick={loadHistory}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-space-850 hover:bg-space-800 border border-slate-700 text-xs text-slate-300 transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl glass-panel flex flex-wrap items-center gap-4 border border-slate-800 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <Filter className="w-4 h-4 text-cyan-400" />
          <span>Filters:</span>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <label className="text-slate-400">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-space-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-400"
          >
            <option value="">All Statuses</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="NO_VALID_MODEL">NO_VALID_MODEL</option>
            <option value="ALL_VALID_MODELS_FAILED">ALL_VALID_MODELS_FAILED</option>
          </select>
        </div>

        {/* Model Filter */}
        <div className="flex items-center gap-2">
          <label className="text-slate-400">Model:</label>
          <select
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            className="bg-space-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-400"
          >
            <option value="">All Models</option>
            <option value="mini">Mini</option>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </div>
      </div>

      {/* History Table */}
      <div className="rounded-3xl glass-panel border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-space-900/60 text-slate-400 font-mono text-[11px]">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Prompt Preview</th>
                <th className="py-3 px-4">Selected Model</th>
                <th className="py-3 px-4">Outcome</th>
                <th className="py-3 px-4">Latency</th>
                <th className="py-3 px-4">Cost</th>
                <th className="py-3 px-4">Attempts</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {history.length > 0 ? (
                history.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedItem(row.full_response)}
                    className="hover:bg-space-900/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="py-3.5 px-4 font-sans text-slate-200 max-w-xs truncate">
                      "{row.prompt}"
                    </td>
                    <td className="py-3.5 px-4 text-white font-semibold">
                      {row.selected_model_id?.toUpperCase() || '-'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        row.success
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                      }`}>
                        {row.status_code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-cyan-300">
                      {row.total_observed_latency_ms} ms
                    </td>
                    <td className="py-3.5 px-4 text-emerald-300">
                      ${row.total_estimated_cost.toFixed(5)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {row.attempts_count} {row.failover_occurred ? '⚠️ (Failover)' : ''}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="text-cyan-400 hover:text-cyan-300 text-[11px] flex items-center justify-end gap-1">
                        <span>Inspect</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                    {loading ? 'Loading persistent records...' : 'No routing records found matching filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer / Modal for Detailed Request Inspection */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-space-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-space-900 border border-cyan-500/30 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-bold text-lg text-white">Audit Trace: {selectedItem.request_id}</h3>
                <p className="text-xs text-slate-400 font-mono">
                  Executed at {new Date(selectedItem.timestamp).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyJson}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-space-850 border border-slate-700 text-xs text-slate-300 hover:text-cyan-300"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                </button>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1.5 rounded-lg bg-space-850 hover:bg-space-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Prompt and Complexity */}
            <div className="p-4 rounded-2xl bg-space-950 border border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-400 uppercase font-mono">Prompt Query</div>
              <p className="text-xs text-white font-mono">{selectedItem.prompt}</p>
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-900 text-xs font-mono">
                <span className="text-purple-300">Complexity: Level {selectedItem.effective_min_capability}</span>
                <span className="text-slate-500">•</span>
                <span className="text-cyan-400">Tokens: {selectedItem.token_metrics.estimated_input_tokens} in / {selectedItem.token_metrics.expected_output_tokens} out</span>
                <span className="text-slate-500">•</span>
                <span className="text-emerald-400">Savings: {selectedItem.cost_savings_percent}%</span>
              </div>
            </div>

            {/* Evaluations & Rejection Reasons */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                Model Evaluations (Filter Stage)
              </h4>
              <div className="space-y-2">
                {selectedItem.all_evaluations.map((ev) => (
                  <div
                    key={ev.model_id}
                    className={`p-3 rounded-xl border text-xs ${
                      ev.is_valid
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-rose-500/10 border-rose-500/30'
                    }`}
                  >
                    <div className="flex justify-between font-bold">
                      <span className="text-white">{ev.model_name} (Cap {ev.capability})</span>
                      <span className={ev.is_valid ? 'text-emerald-300' : 'text-rose-400'}>
                        {ev.is_valid ? 'VALID' : 'REJECTED'}
                      </span>
                    </div>
                    {ev.rejection_reasons.length > 0 && (
                      <div className="mt-1 space-y-0.5 text-[11px] text-rose-300 font-mono">
                        {ev.rejection_reasons.map((r, i) => (
                          <div key={i}>• {r}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Execution Trace */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                Execution Trace (Attempts Chronology)
              </h4>
              <div className="space-y-2">
                {selectedItem.execution_trace.map((att) => (
                  <div
                    key={att.attempt_number}
                    className={`p-3 rounded-xl border text-xs font-mono ${
                      att.success ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'
                    }`}
                  >
                    <div className="flex justify-between font-bold">
                      <span>Attempt #{att.attempt_number}: {att.model_name}</span>
                      <span>{att.observed_latency_ms} ms</span>
                    </div>
                    <div className="mt-1 text-[11px]">
                      {att.success ? '✓ Succeeded' : `✗ Failed: ${att.error_reason}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
