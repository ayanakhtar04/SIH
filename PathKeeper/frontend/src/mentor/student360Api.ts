import { API_BASE } from '../api';

const base = `${API_BASE.replace(/\/$/,'')}/students`;
// Force fresh reads to reflect mentor/admin updates immediately across tabs
async function j<T>(url:string, token:string): Promise<T> {
  const r = await fetch(url, {
    headers: { Authorization:`Bearer ${token}`, 'Cache-Control':'no-cache', 'Pragma':'no-cache' },
    cache: 'no-store'
  } as RequestInit);
  const data = await r.json().catch(()=> ({}));
  if(!r.ok || data.ok===false) throw new Error(data.error||`HTTP ${r.status}`);
  return data;
}

export interface Student360Data {
  ok: true;
  student: { id:string; name:string; email:string; studentCode:string; program?:string|null; year?:number|null; riskScore?:number|null; riskTier:string; lastRiskUpdated?:string|null; mentorId?:string|null; mentorName?:string|null; phone?:string|null; guardianName?:string|null; guardianEmail?:string|null; guardianPhone?:string|null };
  academics?: { attendancePercent?: number|null; cgpa?: number|null; assignmentsCompleted?: number|null; assignmentsTotal?: number|null; subjects?: any[]; mentorAcademicNote?: string|null; lastAcademicUpdate?: string|null };
  trend: { idx:number; score:number }[];
  assignments: any[];
  notes: any[];
  meetings: any[];
}

export const fetchStudent360 = (token:string, id:string) => j<Student360Data>(`${base}/${id}/360?_t=${Date.now()}` as string, token);

// Student self-view helper: wraps 360 using the student id from the token’s subject
export async function fetchMy360(token: string): Promise<Student360Data> {
  // decode without verifying; for client use only
  const [, payload] = token.split('.') as any;
  const json = JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/')));
  const id = json?.id || json?.sub;
  if (!id) throw new Error('Invalid token');
  return fetchStudent360(token, id);
}

// Mentor dropout assessment: send mentor-provided factors to update risk and get counseling tips
export async function assessDropout(token: string, id: string, payload: {
  cgpa?: number;
  attendancePercent?: number;
  fees?: 'clear' | 'due' | 'severe';
  behavior?: number; // 0-10
  motivation?: number; // 0-10
}) {
  const url = `${base}/${id}/dropout-assess`;
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
  const data = await r.json().catch(()=> ({}));
  if (!r.ok || data.ok === false) throw new Error(data.error || `HTTP ${r.status}`);
  return data as { ok:true; student:{ id:string; riskScore:number; riskTier:string; lastRiskUpdated:string }; counseling: string[] };
}
