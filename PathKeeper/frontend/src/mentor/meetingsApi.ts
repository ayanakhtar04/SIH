import { API_BASE } from '../api';

const base = `${API_BASE.replace(/\/$/,'')}/meetings`;

async function j<T>(url:string, init: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const data = await r.json().catch(()=> ({}));
  if (!r.ok || data.ok === false) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}
export interface Meeting { id:string; studentId:string; mentorId?:string|null; title:string; startsAt:string; endsAt:string; location?:string|null; notes?:string|null; status:string; }

export const listStudentMeetings = (token:string, studentId:string) =>
  j<{ ok:true; meetings:Meeting[] }>(`${base}/student/${studentId}`, { headers:{ Authorization:`Bearer ${token}` } });

export const createMeeting = (token:string, data:{ studentId:string; title:string; startsAt:string; endsAt:string; location?:string; notes?:string }) =>
  j<{ ok:true; meeting:Meeting }>(base, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify(data) });

export const cancelMeeting = (token:string, id:string) =>
  j<{ ok:true; meeting:Meeting }>(`${base}/${id}/cancel`, { method:'PATCH', headers:{ Authorization:`Bearer ${token}` } });
