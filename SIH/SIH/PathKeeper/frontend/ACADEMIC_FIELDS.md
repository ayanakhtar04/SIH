# Academic Field Integration

Backend PATCH endpoint `/api/students/:id` accepts these JSON fields (any subset):

- `attendancePercent` (number 0-100)
- `cgpa` (number 0-10 unless environment variable `CGPA_SCALE=5` then 0-5)
- `assignmentsCompleted` (integer >= 0)
- `assignmentsTotal` (integer >= 0)
- `subjects` (array of strings) – persisted as `subjectsJson` internally
- `mentorAcademicNote` (string, <= 5000 chars)

Response includes (subset):
```
{
  ok: true,
  student: {
    id,
    riskScore,       // 0-1 (float)
    riskTier,        // High | Medium | Low
    attendancePercent,
    cgpa,
    assignmentsCompleted,
    assignmentsTotal
  }
}
```

## Frontend Mapping Guidance
Current mentor dashboard uses synthetic placeholders (`attendance`, `gpa`, `assignmentsSubmitted`). Replace them with real backend fields:

| UI Concept              | Backend Field          | Notes |
|-------------------------|------------------------|-------|
| Attendance (%)          | `attendancePercent`    | Already a percentage 0-100 |
| GPA / CGPA              | `cgpa`                 | Scale dynamic (check `process.env.CGPA_SCALE`) |
| Assignments Completed   | `assignmentsCompleted` | Use with assignmentsTotal to compute ratio |
| Assignments Total       | `assignmentsTotal`     | If 0, avoid division by zero |
| Assignments Submitted % | derive: completed/total| `Math.round((c / Math.max(1,t))*100)` |
| Academic Note           | `mentorAcademicNote`   | Text may influence risk (keywords) |

### Example Fetch Mapping
```ts
// After GET /api/students
const mapped = apiStudents.map(s => ({
  id: s.id,
  name: s.name,
  email: s.email,
  attendance: s.attendancePercent ?? 0,
  gpa: s.cgpa ?? 0,
  assignmentsCompleted: s.assignmentsCompleted ?? 0,
  assignmentsTotal: s.assignmentsTotal ?? 0,
  assignmentsSubmitted: s.assignmentsCompleted ?? 0, // backward compatibility
  risk: { level: s.riskTier, score: s.riskScore },
}));
```

### Updating Metrics
```ts
await fetch(`/api/students/${id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ attendancePercent: 91, cgpa: 7.8, assignmentsCompleted: 9, assignmentsTotal: 12 })
});
```

On success update local state with returned academic + risk fields.

### Risk Recalculation
Risk recomputes when any of these change: attendancePercent, cgpa, assignmentsCompleted/Total, mentorAcademicNote, subjects.

### Edge Cases
- If only `mentorAcademicNote` changes and contains trigger keywords (fail, risk, struggl, drop, absent) risk may slightly increase.
- Partial updates: send only changed fields; untouched ones remain.
- Validation errors: 400 if no allowed fields present.
- Unauthorized: 403 if mentor patching a student not assigned to them.

### Migration Safety
`ensureAcademicColumns()` safeguards runtime if migrations didn't add columns yet (SQLite).

---
Add a link to this file in developer docs if needed.
