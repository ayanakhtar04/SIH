import React, { useEffect, useState } from 'react';
import { Box, Button, Stack } from '@mui/material';
import { useAuth } from '../auth/AuthContext';
import { API_BASE } from '../api';
import './MenteeForm.css';

const endpoint = `${API_BASE}/mentee-form`;

const MenteeForm: React.FC = () => {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<any>({
    name: '', enrollment: '', blood_group: '', father_name: '', mother_name: '',
    student_email: '', father_email: '', student_mobile: '+91-', father_mobile: '+91-', mother_mobile: '+91-',
    course: '', branch: '', department: '', semester: '', hobbies: '', gender: 'male',
    permanent_address: '', correspondence_address: '',
    odd_sem_year: '', odd_sem_marks: '', even_sem_year: '', even_sem_marks: '', back_papers: '',
    career_aspirations: '', institute_help: '',
    personal_problems: '', professional_problems: '', disciplinary_record: ''
  });

  useEffect(() => {
    if (!session) return;
    const token = session.token;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      const studentId = payload.sub;
      fetch(`${endpoint}/${studentId}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => { if (!r.ok) throw new Error('no form'); return r.json(); })
        .then(j => { 
          if (j.data) setForm((prev:any) => ({ ...prev, ...j.data })); 
          setSaved(true); 
        })
        .catch(() => {})
    } catch (e) { /* ignore */ }
  }, [session]);

  const change = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((p:any) => ({ ...p, [name]: value }));
  };

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!session) return;
    setLoading(true);
    const token = session.token;
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
    if (!res.ok) { alert('Save failed'); setLoading(false); return; }
    setSaved(true); setLoading(false);
    alert('Form saved');
  };

  return (
    <div className="mentee-form-container">
      <div className="mentee-form-wrapper">
        <h1>Mentee Registration Form</h1>
        <form onSubmit={submit}>
          
          <div className="mentee-form-group">
            <label htmlFor="name">1. Name of the Student (In CAPITAL):</label>
            <input type="text" id="name" name="name" value={form.name} onChange={change} required />
          </div>

          <div className="mentee-form-inline-group">
            <div className="mentee-form-group">
              <label htmlFor="enrollment">2. Enrolment Number:</label>
              <input type="text" id="enrollment" name="enrollment" value={form.enrollment} onChange={change} required />
            </div>
            <div className="mentee-form-group">
              <label htmlFor="blood_group">5. Blood Group:</label>
              <input type="text" id="blood_group" name="blood_group" value={form.blood_group} onChange={change} />
            </div>
          </div>

          <div className="mentee-form-group">
            <label htmlFor="father_name">3. Father's Name (in CAPITAL):</label>
            <input type="text" id="father_name" name="father_name" value={form.father_name} onChange={change} required />
          </div>

          <div className="mentee-form-group">
            <label htmlFor="mother_name">4. Mother's Name (in CAPITAL):</label>
            <input type="text" id="mother_name" name="mother_name" value={form.mother_name} onChange={change} required />
          </div>
          
          <div className="mentee-form-inline-group">
            <div className="mentee-form-group">
              <label htmlFor="student_email">6. Email-id (STUDENT):</label>
              <input type="email" id="student_email" name="student_email" value={form.student_email} onChange={change} required />
            </div>
            <div className="mentee-form-group">
              <label htmlFor="father_email">7. Email-id (FATHER):</label>
              <input type="email" id="father_email" name="father_email" value={form.father_email} onChange={change} />
            </div>
          </div>

          <div className="mentee-form-inline-group">
            <div className="mentee-form-group">
              <label htmlFor="student_mobile">8. Mobile No (STUDENT):</label>
              <input type="text" id="student_mobile" name="student_mobile" value={form.student_mobile} onChange={change} required />
            </div>
            <div className="mentee-form-group">
              <label htmlFor="father_mobile">9. Mobile No (FATHER):</label>
              <input type="text" id="father_mobile" name="father_mobile" value={form.father_mobile} onChange={change} />
            </div>
            <div className="mentee-form-group">
              <label htmlFor="mother_mobile">10. Mobile No (MOTHER):</label>
              <input type="text" id="mother_mobile" name="mother_mobile" value={form.mother_mobile} onChange={change} />
            </div>
          </div>

          <div className="mentee-form-inline-group">
            <div className="mentee-form-group">
              <label htmlFor="course">11. Course:</label>
              <input type="text" id="course" name="course" value={form.course} onChange={change} required />
            </div>
            <div className="mentee-form-group">
              <label htmlFor="branch">12. Branch:</label>
              <input type="text" id="branch" name="branch" value={form.branch} onChange={change} required />
            </div>
          </div>

          <div className="mentee-form-inline-group">
            <div className="mentee-form-group">
              <label htmlFor="department">Department:</label>
              <input type="text" id="department" name="department" value={form.department} onChange={change} />
            </div>
            <div className="mentee-form-group">
              <label htmlFor="semester">Semester:</label>
              <input type="text" id="semester" name="semester" value={form.semester} onChange={change} />
            </div>
          </div>
          
          <div className="mentee-form-group">
            <label htmlFor="hobbies">13. Hobbies:</label>
            <input type="text" id="hobbies" name="hobbies" value={form.hobbies} onChange={change} />
          </div>

          <div className="mentee-form-group">
            <label>Gender:</label>
            <div className="mentee-form-checkbox-group">
              <label><input type="radio" name="gender" value="male" checked={form.gender === 'male'} onChange={change} /> Male</label>
              <label><input type="radio" name="gender" value="female" checked={form.gender === 'female'} onChange={change} /> Female</label>
            </div>
          </div>

          <div className="mentee-form-group">
            <h2>14. Address Details</h2>
            <label htmlFor="permanent_address">Permanent Address:</label>
            <textarea id="permanent_address" name="permanent_address" rows={3} value={form.permanent_address} onChange={change}></textarea>

            <label htmlFor="correspondence_address">Corresponds Address:</label>
            <textarea id="correspondence_address" name="correspondence_address" rows={3} value={form.correspondence_address} onChange={change}></textarea>
          </div>

          <div className="mentee-form-group">
            <h2>15. Academic Performance - Marks in the last two Semesters (%)</h2>
            <div className="mentee-form-academic-section">
              <div>
                <label>A. Odd Sem. (202__)</label>
                <input type="text" name="odd_sem_year" placeholder="Year (e.g., 3-4)" value={form.odd_sem_year} onChange={change} />
                <label>Marks:</label>
                <input type="text" name="odd_sem_marks" placeholder="% or CGPA" value={form.odd_sem_marks} onChange={change} />
              </div>
              <div>
                <label>B. Even Sem. (202__)</label>
                <input type="text" name="even_sem_year" placeholder="Year (e.g., 3-4)" value={form.even_sem_year} onChange={change} />
                <label>Marks:</label>
                <input type="text" name="even_sem_marks" placeholder="% or CGPA" value={form.even_sem_marks} onChange={change} />
              </div>
            </div>
            <label htmlFor="back_papers">C. Back Papers (if any):</label>
            <input type="text" id="back_papers" name="back_papers" placeholder="List the subjects/codes" value={form.back_papers} onChange={change} />
          </div>

          <div className="mentee-form-group">
            <label htmlFor="career_aspirations">16. What are your career aspirations?</label>
            <textarea id="career_aspirations" name="career_aspirations" rows={4} value={form.career_aspirations} onChange={change}></textarea>
          </div>
          
          <div className="mentee-form-group">
            <label htmlFor="institute_help">17. How can the institute help you in achieving your aspirations?</label>
            <textarea id="institute_help" name="institute_help" rows={4} value={form.institute_help} onChange={change}></textarea>
          </div>

          <div className="mentee-form-mentor-use">
            <h3>To be filled by the Mentor (Sections 18-20)</h3>
            
            <div className="mentee-form-group">
              <label htmlFor="personal_problems">18. Personal Problems (if any):</label>
              <textarea id="personal_problems" name="personal_problems" rows={3} value={form.personal_problems} onChange={change} disabled></textarea>
            </div>

            <div className="mentee-form-group">
              <label htmlFor="professional_problems">19. Professional Problems (if any):</label>
              <textarea id="professional_problems" name="professional_problems" rows={3} value={form.professional_problems} onChange={change} disabled></textarea>
            </div>

            <div className="mentee-form-group">
              <label htmlFor="disciplinary_record">20. Disciplinary Record (Whether punished for any act of indiscipline):</label>
              <input type="text" id="disciplinary_record" name="disciplinary_record" value={form.disciplinary_record} onChange={change} disabled />
            </div>
          </div>
          
          <div className="mentee-form-signature-section">
            <div className="mentee-form-signature-box">
              <p>Signature of Student (Mentee)</p>
            </div>
            <div className="mentee-form-signature-box">
              <p>Signature of Mentor</p>
            </div>
            <div className="mentee-form-signature-box">
              <p>Signature of Dy. Dean (FCI)</p>
            </div>
          </div>

          <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 4 }}>
            <Button variant="contained" type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save Form'}</Button>
            {saved && <Button variant="outlined" onClick={()=>{ if(!session) return; try { const payload = JSON.parse(atob(session.token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); const studentId = payload.sub; window.open(`${API_BASE}/mentee-form/${studentId}/pdf`, '_blank'); } catch(e){} }}>Download PDF</Button>}
          </Stack>

        </form>
      </div>
    </div>
  )
}

export default MenteeForm;

