import { API_BASE } from '../api';

export interface NotifyPayload {
  channel: 'email'|'sms';
  studentIds?: string[];
  recipients?: string[];
  subject?: string;
  body: string;
}

export async function sendNotification(token: string, payload: NotifyPayload) {
  const res = await fetch(`${API_BASE.replace(/\/$/,'')}/notify`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Notify failed ${res.status}`);
  return res.json();
}

export async function fetchDraft(token: string, opts: { studentId?: string; contextType?: string; tone?: string } = {}) {
  const res = await fetch(`${API_BASE.replace(/\/$/,'')}/assist/draft`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(opts)
  });
  if (!res.ok) throw new Error('Draft failed');
  return res.json();
}

export async function fetchNotificationLogs(token: string, limit=50) {
  const res = await fetch(`${API_BASE.replace(/\/$/,'')}/notifications/logs?limit=${limit}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Logs failed');
  return res.json();
}
