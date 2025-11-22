const BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:7070/api/auth';

async function jsonFetch<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(opts.headers||{}) }, ...opts });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export interface AuthResult { ok: boolean; token: string; student?: any; user?: any; }

export const studentSignup = (data: { name:string; email:string; password:string; studentCode?:string }) =>
  jsonFetch<AuthResult>(`${BASE}/student/signup`, { method:'POST', body: JSON.stringify(data) });
export const studentLogin = (data: { email:string; password:string }) =>
  jsonFetch<AuthResult>(`${BASE}/student/login`, { method:'POST', body: JSON.stringify(data) });
export const teacherSignup = (data: { name:string; email:string; password:string }) =>
  jsonFetch<AuthResult>(`${BASE}/teacher/signup`, { method:'POST', body: JSON.stringify(data) });
export const teacherLogin = (data: { email:string; password:string }) =>
  jsonFetch<AuthResult>(`${BASE}/teacher/login`, { method:'POST', body: JSON.stringify(data) });
export const me = (token: string) => jsonFetch(`${BASE}/me`, { headers: { Authorization: `Bearer ${token}` } });
