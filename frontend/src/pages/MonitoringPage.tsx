import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  TrendingUp,
  PieChart as PieIcon,
  BarChart2,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import { DashboardMetrics, RequestHistoryItem } from '../types';
import { fetchDashboard, fetchHistory } from '../services/api';

const COLORS = ['#00F2FE', '#3B82F6', '#8B5CF6', '#F59E0B', '#10B981'];

export const MonitoringPage: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [history, setHistory] = useState<RequestHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dash, hist] = await Promise.all([fetchDashboard(), fetchHistory(20)]);
      setMetrics(dash);
      setHistory(hist);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Format data for model share pie chart
  const modelUsageData = metrics?.model_usage
    ? Object.entries(metrics.model_usage).map(([name, value]) => ({ name, value }))
    : [];

  // Format data for model failure bar chart
  const failureData = metrics?.model_failure_counts
    ? Object.entries(metrics.model_failure_counts).map(([model, count]) => ({ model, count }))
    : [];

  // Generate simulated historical trend from history items
  const trendData = history.slice(0, 10).reverse().map((item, idx) => ({
    name: `#${idx + 1}`,
    latency: item.total_observed_latency_ms,
    cost: item.total_estimated_cost * 1000,
    success: item.success ? 1 : 0
  }));

  return (
    <div className="space-y-8 pb-12">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-cyan-400" />
            <span>Real-time Monitoring & Observability</span>
          </h1>
          <p className="text-xs text-slate-400">
            Live metrics, model distribution, latency distributions, and total cost savings versus the baseline frontier model.
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-space-850 hover:bg-space-800 border border-slate-700 text-xs text-slate-300 transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* Top 5 Metrics Cards (Matching Screen 7) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 rounded-2xl glass-panel space-y-1">
          <div className="text-[11px] font-mono text-slate-400">Total Requests</div>
          <div className="text-2xl font-bold text-white">{metrics?.total_requests ?? 0}</div>
          <div className="text-[10px] text-cyan-400 font-mono">100% tracked</div>
        </div>

        <div className="p-4 rounded-2xl glass-panel space-y-1">
          <div className="text-[11px] font-mono text-slate-400">Successful</div>
          <div className="text-2xl font-bold text-emerald-400">{metrics?.successful_requests ?? 0}</div>
          <div className="text-[10px] text-emerald-400 font-mono">{metrics?.success_rate_percent ?? 100}% rate</div>
        </div>

        <div className="p-4 rounded-2xl glass-panel space-y-1">
          <div className="text-[11px] font-mono text-slate-400">Failed / Breached</div>
          <div className="text-2xl font-bold text-rose-400">{metrics?.failed_requests ?? 0}</div>
          <div className="text-[10px] text-rose-400 font-mono">Excluded or timeouts</div>
        </div>

        <div className="p-4 rounded-2xl glass-panel space-y-1">
          <div className="text-[11px] font-mono text-slate-400">Avg Latency</div>
          <div className="text-2xl font-bold text-cyan-300">{metrics?.avg_latency_ms ?? 0} ms</div>
          <div className="text-[10px] text-slate-400 font-mono">Observed runtime</div>
        </div>

        <div className="p-4 rounded-2xl glass-panel space-y-1">
          <div className="text-[11px] font-mono text-slate-400">Cost Savings</div>
          <div className="text-2xl font-bold text-purple-300">{metrics?.savings_percent ?? 0}%</div>
          <div className="text-[10px] text-purple-400 font-mono">${(metrics?.total_savings_vs_large ?? 0).toFixed(4)} saved</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Latency & Cost Trend Area Chart */}
        <div className="lg:col-span-8 p-6 rounded-3xl glass-panel space-y-4 border border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span>Observed Latency Trend Across Recent Requests</span>
            </h2>
            <span className="text-[11px] font-mono text-slate-500">Latency (ms)</span>
          </div>

          <div className="h-64 w-full">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00F2FE" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#00F2FE" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#070D1D', borderColor: '#334155', borderRadius: '12px' }}
                    labelStyle={{ color: '#00F2FE' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="latency"
                    stroke="#00F2FE"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#latencyGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Execute queries in the Ask Playground to populate live trends.
              </div>
            )}
          </div>
        </div>

        {/* Model Share Donut Chart */}
        <div className="lg:col-span-4 p-6 rounded-3xl glass-panel space-y-4 border border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-purple-400" />
              <span>Model Routing Share</span>
            </h2>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {modelUsageData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={modelUsageData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {modelUsageData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#070D1D', borderColor: '#334155', borderRadius: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-500 text-center">
                No routing records yet.
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-2 text-xs">
            {modelUsageData.map((entry, idx) => (
              <div key={entry.name} className="flex items-center gap-1.5 font-mono text-[11px]">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                <span className="text-slate-300">{entry.name}</span>
                <span className="text-slate-500">({entry.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity Stream (Matching Screen 7 lower right) */}
      <div className="p-6 rounded-3xl glass-panel space-y-4 border border-slate-800">
        <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span>Recent Execution Activity & Failover Feed</span>
        </h2>

        <div className="space-y-2.5">
          {history.length > 0 ? (
            history.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-2xl bg-space-950/70 border border-slate-800/80 flex items-center justify-between text-xs font-mono"
              >
                <div className="flex items-center gap-3">
                  {item.success ? (
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
                      <XCircle className="w-4 h-4" />
                    </div>
                  )}
                  <div>
                    <div className="font-sans font-semibold text-slate-200">
                      {item.selected_model_id
                        ? `${item.selected_model_id.toUpperCase()} Selected`
                        : item.status_code}
                      {item.failover_occurred && (
                        <span className="ml-2 text-amber-400 font-mono text-[10px]">
                          (Failover Triggered)
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono truncate max-w-md">
                      "{item.prompt}"
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-cyan-400 font-bold">{item.total_observed_latency_ms} ms</div>
                  <div className="text-[10px] text-slate-500">${item.total_estimated_cost.toFixed(5)}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-slate-500 text-center py-4">No recent activity.</div>
          )}
        </div>
      </div>
    </div>
  );
};
