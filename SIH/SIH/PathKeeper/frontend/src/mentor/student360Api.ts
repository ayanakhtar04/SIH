import { API_BASE } from '../api';

const base = `${API_BASE.replace(/\/$/,'')}/students`;
async function j<T>(url:string, token:string): Promise<T> { const r = await fetch(url, { headers:{ Authorization:`Bearer ${token}` } }); const data = await r.json().catch(()=> ({})); if(!r.ok || data.ok===false) throw new Error(data.error||`HTTP ${r.status}`); return data; }

export interface Student360Data {
  ok: true;
  student: { id:string; name:string; email:string; studentCode:string; program?:string|null; year?:number|null; riskScore?:number|null; riskTier:string; lastRiskUpdated?:string|null };
  trend: { idx:number; score:number }[];
  assignments: any[];
  notes: any[];
  meetings: any[];
}

export const fetchStudent360 = (token:string, id:string) => j<Student360Data>(`${base}/${id}/360`, token);
