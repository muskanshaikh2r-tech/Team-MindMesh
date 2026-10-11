import {
  ModelConfig,
  ModelUpdate,
  RouteRequest,
  RouteResponse,
  ComplexityAnalysis,
  RequestHistoryItem,
  DashboardMetrics,
  DemoScenario
} from '../types';

const API_BASE = '/api';

export async function fetchModels(): Promise<ModelConfig[]> {
  const res = await fetch(`${API_BASE}/models`);
  if (!res.ok) throw new Error('Failed to fetch models');
  return res.json();
}

export async function updateModel(modelId: string, updates: ModelUpdate): Promise<ModelConfig> {
  const res = await fetch(`${API_BASE}/models/${modelId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error('Failed to update model settings');
  return res.json();
}

export async function resetModels(): Promise<ModelConfig[]> {
  const res = await fetch(`${API_BASE}/models/reset`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to reset models');
  return res.json();
}

export async function routeRequest(request: RouteRequest): Promise<RouteResponse> {
  const res = await fetch(`${API_BASE}/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || 'Routing request failed');
  }
  return res.json();
}

export async function estimateComplexity(prompt: string, manualOverride?: number | null): Promise<ComplexityAnalysis> {
  const params = new URLSearchParams({ prompt });
  if (manualOverride) params.append('manual_override', manualOverride.toString());
  const res = await fetch(`${API_BASE}/estimate?${params.toString()}`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to estimate complexity');
  return res.json();
}

export async function fetchHistory(
  limit = 50,
  offset = 0,
  status?: string,
  model?: string
): Promise<RequestHistoryItem[]> {
  const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
  if (status) params.append('status', status);
  if (model) params.append('model', model);
  const res = await fetch(`${API_BASE}/history?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

export async function fetchHistoryDetail(requestId: string): Promise<RouteResponse> {
  const res = await fetch(`${API_BASE}/history/${requestId}`);
  if (!res.ok) throw new Error('Failed to fetch request detail');
  return res.json();
}

export async function fetchDashboard(): Promise<DashboardMetrics> {
  const res = await fetch(`${API_BASE}/dashboard`);
  if (!res.ok) throw new Error('Failed to fetch dashboard metrics');
  return res.json();
}

export async function fetchScenarios(): Promise<DemoScenario[]> {
  const res = await fetch(`${API_BASE}/scenarios`);
  if (!res.ok) throw new Error('Failed to fetch demo scenarios');
  return res.json();
}
