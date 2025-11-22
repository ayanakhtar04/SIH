import { API_BASE } from '../api';

export interface AdminUser { id: string; email: string; name: string; role: string; createdAt: string; }

function authHeaders(token: string) { return { Authorization: `Bearer ${token}`, 'Content-Type':'application/json' }; }

export async function listUsers(token: string, role?: string): Promise<AdminUser[]> {
  const url = `${API_BASE.replace(/\/$/, '')}/users${role? `?role=${encodeURIComponent(role)}`:''}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`List failed ${res.status}`);
  const json = await res.json();
  return json.users || [];
}

export async function createUser(token: string, data: { email: string; name: string; role: string; password: string }): Promise<AdminUser> {
  const url = `${API_BASE.replace(/\/$/, '')}/users`;
  const res = await fetch(url, { method:'POST', headers: authHeaders(token), body: JSON.stringify(data) });
  if (!res.ok) throw new Error(`Create failed ${res.status}`);
  const json = await res.json();
  return json.user;
}

export async function deleteUser(token: string, id: string): Promise<void> {
  const url = `${API_BASE.replace(/\/$/, '')}/users/${id}`;
  const res = await fetch(url, { method:'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Delete failed ${res.status}`);
}

export async function resetUserPassword(token: string, id: string, password: string): Promise<void> {
  const url = `${API_BASE.replace(/\/$/, '')}/users/${id}/reset-password`;
  const res = await fetch(url, { method:'POST', headers: authHeaders(token), body: JSON.stringify({ password }) });
  if (!res.ok) throw new Error(`Reset failed ${res.status}`);
}
