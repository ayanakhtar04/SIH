// Centralized API base and helpers
// Prefer explicit VITE_API_BASE (full URL or path). Fallback to proxy prefix /api.
// You can also set VITE_BACKEND_URL (e.g. http://localhost:5000) and we build endpoints directly.
const viteEnv: any = (import.meta as any).env || {};
const explicitBase = viteEnv.VITE_API_BASE;
const backendUrl = viteEnv.VITE_BACKEND_URL;
export const API_BASE = (explicitBase || (backendUrl ? `${backendUrl.replace(/\/$/, '')}/api` : '/api'));
export const API = {
  students: `${API_BASE.replace(/\/$/, '')}/students`,
  studentsImport: `${API_BASE.replace(/\/$/, '')}/students/import`,
  studentsImportTemplate: `${API_BASE.replace(/\/$/, '')}/students/import/template`,
  studentMe: `${API_BASE.replace(/\/$/, '')}/auth/student/me`,
  train: `${API_BASE.replace(/\/$/, '')}/train`,
  predict: `${API_BASE.replace(/\/$/, '')}/predict`,
  regenerate: `${API_BASE.replace(/\/$/, '')}/regenerate_dataset`,
  health: `/health`,
  notifications: `${API_BASE.replace(/\/$/, '')}/notifications`,
};

export async function fetchImportTemplate(token?: string) {
  const res = await fetch(API.studentsImportTemplate, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!res.ok) throw new Error('Failed to fetch template');
  return res.json();
}

export interface ImportResponse {
  ok: boolean; dryRun: boolean; counts: { total: number; valid: number; created: number; skipped: number; errors: number }; errors: { line: number; error: string }[]; rows: any[];
}

export async function importStudentsRaw(csv: string, opts: { dryRun?: boolean; token?: string } = {}): Promise<ImportResponse> {
  const url = opts.dryRun === false ? `${API.studentsImport}?dryRun=false` : API.studentsImport;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/csv',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {})
    },
    body: csv
  });
  if (!res.ok) throw new Error(`Import failed: ${res.status}`);
  return res.json();
}

export async function importStudentsFile(file: File, opts: { dryRun?: boolean; token?: string } = {}): Promise<ImportResponse> {
  const form = new FormData();
  form.append('file', file);
  form.append('dryRun', String(opts.dryRun !== false));
  const res = await fetch(API.studentsImport, {
    method: 'POST',
    headers: opts.token ? { Authorization: `Bearer ${opts.token}` } : undefined,
    body: form
  });
  if (!res.ok) throw new Error(`Import failed: ${res.status}`);
  return res.json();
}
