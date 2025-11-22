import { API_BASE } from '../api';

export interface OverviewMetrics {
  studentsTotal: number; highRisk: number; mediumRisk: number; lowRisk: number;
  playbookAssignmentsActive: number; meetingsUpcoming: number; notesLast7d: number; avgRisk: number | null;
}
export interface RiskTrendPoint { date: string; avgRisk: number | null; highCount: number; mediumCount: number; lowCount: number; }
export interface EffectivenessMetrics {
  totals: { total:number; completed:number; inProgress:number; assigned:number };
  completionRate: number; avgCompletionDays: number | null; meetingCompletionRate: number;
}

export async function fetchOverview(token: string): Promise<OverviewMetrics> {
  const res = await fetch(`${API_BASE.replace(/\/$/,'')}/admin/metrics/overview`, { headers:{ Authorization:`Bearer ${token}` } });
  if (!res.ok) throw new Error('Overview fetch failed');
  const j = await res.json();
  return j.overview;
}
export async function fetchRiskTrend(token: string, days=30): Promise<RiskTrendPoint[]> {
  const res = await fetch(`${API_BASE.replace(/\/$/,'')}/admin/metrics/risk-trend?days=${days}`, { headers:{ Authorization:`Bearer ${token}` } });
  if (!res.ok) throw new Error('Trend fetch failed');
  const j = await res.json();
  return j.trend;
}
export async function fetchEffectiveness(token: string): Promise<EffectivenessMetrics> {
  const res = await fetch(`${API_BASE.replace(/\/$/,'')}/admin/metrics/interventions/effectiveness`, { headers:{ Authorization:`Bearer ${token}` } });
  if (!res.ok) throw new Error('Effectiveness fetch failed');
  const j = await res.json();
  return j.effectiveness;
}
