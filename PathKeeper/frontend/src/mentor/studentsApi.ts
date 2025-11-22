export interface UpdateStudentPayload {
  attendancePercent?: number;
  cgpa?: number;
  subjects?: { name:string; score?: number }[];
  assignmentsCompleted?: number;
  assignmentsTotal?: number;
  mentorAcademicNote?: string;
}

export async function updateStudent(token:string, id:string, payload:UpdateStudentPayload) {
  const res = await fetch(`/api/students/${id}`, {
    method:'PATCH',
    headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Update failed (${res.status})`);
  return res.json();
}
