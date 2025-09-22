import { API_BASE } from '../api';

function authHeaders(token: string) { return { Authorization: `Bearer ${token}`, 'Content-Type':'application/json' }; }
async function json<T>(url:string, init: RequestInit): Promise<T> { const r = await fetch(url, init); const j = await r.json().catch(()=>({})); if(!r.ok || j.ok===false){ throw new Error(j.error || `HTTP ${r.status}`); } return j; }

export interface Playbook { id:string; key:string; title:string; description?:string; category?:string; steps?:any; active:boolean; }
export interface Assignment { id:string; studentId:string; playbookId:string; status:string; createdAt:string; completedAt?:string|null; notes?:string|null; playbook?:Playbook; }
export interface MentorNote { id:string; studentId:string; mentorId?:string|null; note:string; createdAt:string; }

const base = `${API_BASE.replace(/\/$/,'')}/playbooks`;

export const listPlaybooks = (token:string, opts:{ all?:boolean; category?:string }={}) => {
  const qp = new URLSearchParams();
  if (opts.all) qp.set('all','1');
  if (opts.category) qp.set('category', opts.category);
  return json<{ ok:true; playbooks:Playbook[] }>(`${base}?${qp.toString()}`, { method:'GET', headers: { Authorization:`Bearer ${token}` } });
};
export const createPlaybook = (token:string, data: Partial<Playbook>) => json<{ ok:true; playbook:Playbook }>(base, { method:'POST', headers: authHeaders(token), body: JSON.stringify(data) });
export const assignPlaybook = (token:string, data:{ studentId:string; playbookId:string; notes?:string }) => json<{ ok:true; assignment:Assignment }>(`${base}/assign`, { method:'POST', headers: authHeaders(token), body: JSON.stringify(data) });
export const listAssignments = (token:string, studentId:string) => json<{ ok:true; assignments:Assignment[] }>(`${base}/student/${studentId}`, { method:'GET', headers:{ Authorization:`Bearer ${token}` } });
export const updateAssignmentStatus = (token:string, id:string, status:string) => json<{ ok:true; assignment:Assignment }>(`${base}/assignment/${id}/status`, { method:'PATCH', headers: authHeaders(token), body: JSON.stringify({ status }) });
export const addNote = (token:string, data:{ studentId:string; note:string }) => json<{ ok:true; note:MentorNote }>(`${base}/notes`, { method:'POST', headers: authHeaders(token), body: JSON.stringify(data) });
export const listNotes = (token:string, studentId:string) => json<{ ok:true; notes:MentorNote[] }>(`${base}/notes/${studentId}`, { method:'GET', headers:{ Authorization:`Bearer ${token}` } });
