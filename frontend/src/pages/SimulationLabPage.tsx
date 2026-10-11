import React, { useState } from 'react';
import {
  SlidersHorizontal,
  RotateCcw,
  Save,
  AlertTriangle,
  CheckCircle,
  Zap,
  Clock,
  DollarSign,
  Layers,
  Award,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { ModelConfig, ModelUpdate } from '../types';
import { updateModel, resetModels } from '../services/api';

interface SimulationLabPageProps {
  models: ModelConfig[];
  onRefreshModels: () => void;
  onGoToAsk: () => void;
}

export const SimulationLabPage: React.FC<SimulationLabPageProps> = ({
  models,
  onRefreshModels,
  onGoToAsk
}) => {
  const [editedModels, setEditedModels] = useState<Record<string, ModelConfig>>(
    () => models.reduce((acc, m) => ({ ...acc, [m.id]: { ...m } }), {})
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync when models change from parent
  React.useEffect(() => {
    setEditedModels(models.reduce((acc, m) => ({ ...acc, [m.id]: { ...m } }), {}));
  }, [models]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleFieldChange = (modelId: string, field: keyof ModelConfig, value: any) => {
    setEditedModels((prev) => ({
      ...prev,
      [modelId]: {
        ...prev[modelId],
        [field]: value
      }
    }));
  };

  const handleSaveModel = async (modelId: string) => {
    const config = editedModels[modelId];
    if (!config) return;

    setSavingId(modelId);
    try {
      const updates: ModelUpdate = {
        name: config.name,
        capability: Number(config.capability),
        cost_per_1k: Number(config.cost_per_1k),
        latency_ms: Number(config.latency_ms),
        context_window: Number(config.context_window),
        available: Boolean(config.available),
        failure_rate: Number(config.failure_rate),
        artificial_delay_ms: Number(config.artificial_delay_ms),
        force_fail: Boolean(config.force_fail),
        force_slow: Boolean(config.force_slow),
        description: config.description
      };
      await updateModel(modelId, updates);
      showToast(`Model '${config.name}' settings updated live!`);
      onRefreshModels();
    } catch (e: any) {
      alert(`Failed to save model: ${e.message}`);
    } finally {
      setSavingId(null);
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm('Reset all model endpoints to factory defaults?')) return;
    try {
      await resetModels();
      showToast('All models reset to defaults!');
      onRefreshModels();
    } catch (e: any) {
      alert(`Reset failed: ${e.message}`);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6 text-cyan-400" />
            <span>Simulation Lab & Judge Failure Injections</span>
          </h1>
          <p className="text-xs text-slate-400">
            Edit latency, cost, availability, or inject artificial delays and failures. Changes take effect on the very next query.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-space-850 hover:bg-space-800 border border-slate-700/60 text-xs font-medium text-slate-300 hover:text-cyan-300 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All Defaults</span>
          </button>
          <button
            onClick={onGoToAsk}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-space-950 font-bold text-xs shadow-glow-cyan transition-all"
          >
            <span>Test in Playground</span>
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-bounce">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Model Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {models.map((m) => {
          const edited = editedModels[m.id] || m;
          const isSaving = savingId === m.id;

          return (
            <div
              key={m.id}
              className={`p-6 rounded-3xl glass-panel space-y-5 border transition-all ${
                !edited.available
                  ? 'border-rose-500/40 bg-space-950/90'
                  : edited.force_fail || edited.force_slow
                  ? 'border-amber-500/40 bg-space-950/80'
                  : 'border-slate-800'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                    edited.capability >= 4 ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                    edited.capability >= 3 ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                    'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  }`}>
                    L{edited.capability}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">{edited.name}</h3>
                    <p className="text-[10px] text-slate-500 font-mono">{edited.provider}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Availability Toggle */}
                  <button
                    type="button"
                    onClick={() => handleFieldChange(m.id, 'available', !edited.available)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      edited.available
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    {edited.available ? '● Online' : '○ Offline'}
                  </button>
                </div>
              </div>

              {/* Editable Fields Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* Capability */}
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 font-medium">Capability (1-5)</label>
                  <select
                    value={edited.capability}
                    onChange={(e) => handleFieldChange(m.id, 'capability', Number(e.target.value))}
                    className="w-full bg-space-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                  >
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <option key={lvl} value={lvl}>Level {lvl}</option>
                    ))}
                  </select>
                </div>

                {/* Cost per 1k */}
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 font-medium">Cost / 1k ($)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={edited.cost_per_1k}
                    onChange={(e) => handleFieldChange(m.id, 'cost_per_1k', Number(e.target.value))}
                    className="w-full bg-space-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>

                {/* Expected Latency */}
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 font-medium">Expected Latency (ms)</label>
                  <input
                    type="number"
                    step="25"
                    value={edited.latency_ms}
                    onChange={(e) => handleFieldChange(m.id, 'latency_ms', Number(e.target.value))}
                    className="w-full bg-space-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>

                {/* Context Window */}
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 font-medium">Context Window</label>
                  <input
                    type="number"
                    step="1024"
                    value={edited.context_window}
                    onChange={(e) => handleFieldChange(m.id, 'context_window', Number(e.target.value))}
                    className="w-full bg-space-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>

                {/* Failure Probability */}
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 font-medium">Failure Rate (0.0 - 1.0)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={edited.failure_rate}
                    onChange={(e) => handleFieldChange(m.id, 'failure_rate', Number(e.target.value))}
                    className="w-full bg-space-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>

                {/* Artificial Delay */}
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 font-medium">Artificial Delay (ms)</label>
                  <input
                    type="number"
                    step="50"
                    min="0"
                    value={edited.artificial_delay_ms}
                    onChange={(e) => handleFieldChange(m.id, 'artificial_delay_ms', Number(e.target.value))}
                    className="w-full bg-space-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>

              {/* Special Judge Fault Injection Toggles */}
              <div className="p-3 rounded-2xl bg-space-950/90 border border-slate-800/80 space-y-2">
                <div className="text-[11px] font-semibold text-amber-400 uppercase font-mono flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Fault Injections (Judge Live Testing)</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Force Fail */}
                  <label className="flex items-center gap-2 p-2 rounded-xl bg-space-900 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={edited.force_fail}
                      onChange={(e) => handleFieldChange(m.id, 'force_fail', e.target.checked)}
                      className="rounded bg-space-950 border-slate-700 text-rose-500 focus:ring-0"
                    />
                    <span className={edited.force_fail ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                      Force Fail
                    </span>
                  </label>

                  {/* Force Slow */}
                  <label className="flex items-center gap-2 p-2 rounded-xl bg-space-900 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={edited.force_slow}
                      onChange={(e) => handleFieldChange(m.id, 'force_slow', e.target.checked)}
                      className="rounded bg-space-950 border-slate-700 text-amber-500 focus:ring-0"
                    />
                    <span className={edited.force_slow ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                      Force Slow (Timeout)
                    </span>
                  </label>
                </div>
              </div>

              {/* Save Button */}
              <button
                type="button"
                onClick={() => handleSaveModel(m.id)}
                disabled={isSaving}
                className="w-full py-2.5 rounded-xl bg-space-850 hover:bg-space-800 border border-cyan-500/40 text-cyan-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating Backend SQLite...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save {edited.name} Configuration</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
