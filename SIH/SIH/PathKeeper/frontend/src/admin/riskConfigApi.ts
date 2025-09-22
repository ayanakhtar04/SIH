import { API_BASE } from '../api';

export interface RiskModelConfig {
  id: string;
  version: number;
  weights: Record<string, number>;
  thresholds: { high: number; medium: number; [k: string]: number };
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function fetchRiskConfig(token: string): Promise<{ config: RiskModelConfig }> {
  const res = await fetch(`${API_BASE.replace(/\/$/, '')}/admin/config/risk-model`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Failed to fetch risk config');
  return res.json();
}

export async function saveRiskConfig(token: string, weights: Record<string, number>, thresholds: { high: number; medium: number }): Promise<{ config: RiskModelConfig }> {
  const res = await fetch(`${API_BASE.replace(/\/$/, '')}/admin/config/risk-model`, {
    method: 'PUT',
    headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ weights, thresholds })
  });
  if (!res.ok) throw new Error('Failed to save risk config');
  return res.json();
}
