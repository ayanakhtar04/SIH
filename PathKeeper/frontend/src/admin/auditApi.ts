import { API_BASE } from '../api';

export interface AuditLogEntry {
  id: string;
  action: string;
  actorId?: string | null;
  userId?: string | null;
  details?: string | null;
  createdAt: string;
}

export interface AuditLogResponse {
  ok: boolean;
  logs: AuditLogEntry[];
  page: number; pageSize: number; total: number; totalPages: number;
}

export async function fetchAuditLogs(token: string, opts: { page?: number; pageSize?: number } = {}): Promise<AuditLogResponse> {
  const { page = 1, pageSize = 50 } = opts;
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const res = await fetch(`${API_BASE.replace(/\/$/, '')}/users/audit/logs?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Audit fetch failed ${res.status}`);
  return res.json();
}
