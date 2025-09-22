import { API_BASE } from '../api';

// Allow dedicated auth base override (e.g., separate Node auth service while keeping Flask for data)
// Priority: VITE_AUTH_API_BASE (full URL) > default derived from API_BASE
const viteEnv: any = (import.meta as any).env || {};
const authBaseOverride = viteEnv.VITE_AUTH_API_BASE as string | undefined;
const base = (authBaseOverride ? authBaseOverride.replace(/\/$/, '') : `${API_BASE.replace(/\/$/, '')}/auth`);

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(init?.headers||{}) }, ...init });
  if (!r.ok) {
    let detail = '';
    try { const body = await r.json(); detail = body?.error || body?.message || JSON.stringify(body); } catch { /* ignore */ }
    throw new Error(`HTTP ${r.status}${detail? ': '+detail: ''}`);
  }
  return r.json();
}

export interface AuthResult { ok: boolean; token: string; student?: any; user?: any; }

export const studentSignup = (data: { name:string; email:string; password:string; studentCode?:string }) =>
  json<AuthResult>(`${base}/student/signup`, { method:'POST', body: JSON.stringify(data) });
export const studentLogin = (data: { email:string; password:string }) =>
  json<AuthResult>(`${base}/student/login`, { method:'POST', body: JSON.stringify(data) });
export const mentorSignup = (data: { name:string; email:string; password:string }) =>
  json<AuthResult>(`${base}/mentor/signup`, { method:'POST', body: JSON.stringify(data) });
export const mentorLogin = (data: { email:string; password:string }) =>
  json<AuthResult>(`${base}/mentor/login`, { method:'POST', body: JSON.stringify(data) });
export const teacherSignup = (data: { name:string; email:string; password:string }) =>
  json<AuthResult>(`${base}/teacher/signup`, { method:'POST', body: JSON.stringify(data) });
export const teacherLogin = (data: { email:string; password:string }) =>
  json<AuthResult>(`${base}/teacher/login`, { method:'POST', body: JSON.stringify(data) });
// Generic user login (admin / any persisted user) maps to /auth/login
export const adminLogin = (data: { email:string; password:string }) =>
  json<AuthResult>(`${base}/login`, { method:'POST', body: JSON.stringify(data) });

export function decodeJwt(token: string) {
  try { const p = token.split('.')[1]; return JSON.parse(atob(p.replace(/-/g,'+').replace(/_/g,'/'))); } catch { return null; }
}

export const getStudents = (token: string) =>
  json<{ name: string; email: string; studentCode: string; }[]>(`${base}/students`, { method:'GET', headers: { 'Authorization': `Bearer ${token}` } });

// Self profile endpoints (shared for user kinds)
export interface MeResponse { ok: boolean; user: { id:string; name:string; email:string; role:string }; requireRelogin?: boolean }
export const getMe = (token: string) => json<MeResponse>(`${base}/me`, { method:'GET', headers:{ Authorization:`Bearer ${token}` } });
export const updateMe = (token: string, data: { name?: string; email?: string }) =>
  json<MeResponse>(`${base}/me`, { method:'PATCH', body: JSON.stringify(data), headers:{ Authorization:`Bearer ${token}` } });
export const changeMyPassword = (token: string, data: { currentPassword:string; newPassword:string }) =>
  json<{ ok:boolean; requireRelogin?: boolean }>(`${base}/me/password`, { method:'POST', body: JSON.stringify(data), headers:{ Authorization:`Bearer ${token}` } });
