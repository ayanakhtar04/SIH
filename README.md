# PathKeepers (SIH)

An end-to-end prototype for student risk monitoring, mentoring workflows, and targeted interventions.

Core services:
- Machine Learning & Dataset Service (Flask / Python): Synthetic dataset generation, model training, prediction (risk tiers).
- Application & Auth Service (Node/Express + Prisma): Users, students, mentoring notes, playbook assignments, meetings, risk analytics, notification logging, AI assist draft generation (placeholder), risk model configuration.
- Frontend (React + Vite + MUI): Role-based dashboards (admin, mentor), student 360 profile, interventions, analytics, configuration and data management.


## Quick start (Simplest Path: Flask + Frontend Only)

Prereqs: Node.js 18+ and Python 3.10+ are recommended.

1) Install backend deps and run the API

```
pip install -r PathKeeper/backend/requirements.txt
python PathKeeper/backend/app.py
```

The API listens on http://localhost:5000 by default.

2) Install frontend deps and run the UI

```
npm install --prefix PathKeeper/frontend
npm run dev --prefix PathKeeper/frontend
```

Open the printed Local URL (usually http://localhost:5173 or http://localhost:5174). The dev server proxies /api to the backend.

### Quick start (Full Stack: Node Auth + Flask ML)

If you run authentication on the Node service and still use the Flask service for ML/dataset endpoints:

1. Start Flask (ML/data) backend (e.g. port 5055):
```
python PathKeeper/backend/app.py
```
2. Start Node auth/backend (port 5080):
```
cd PathKeeper/backend-node
set PORT=5080 (Windows PowerShell: $env:PORT="5080")
npm run dev
```
3. Frontend environment (.env or PowerShell before `npm run dev`):
```
BACKEND_URL=http://localhost:5055
VITE_AUTH_API_BASE=http://localhost:5080/api/auth
```
4. Run frontend:
```
cd PathKeeper/frontend
npm run dev
```

The dashboard will call students & ML on Flask via `/api/*` proxy, while auth flows go directly to the Node service using `VITE_AUTH_API_BASE`.


## Project structure (abridged)

```
PathKeeper/
	backend/                  # Flask + scikit-learn API
		app.py                  # API server (autoloads latest model if present)
		generate_dataset.py     # Synthetic dataset generator
		requirements.txt
		models/                 # Persisted models (latest.pkl, model_v*.pkl)
		student_data.csv        # Current dataset
	frontend/                 # React + Vite + MUI dashboard
		src/
			components/Sidebar.tsx
			pages/Overview.tsx
			pages/Settings.tsx
			pages/Notifications.tsx
			api.ts                # Centralized API endpoints
		vite.config.js          # Proxy /api -> backend
		package.json
backend-node/               # Node/Express auth + analytics + interventions API
	src/
		server.ts               # Main app (mounts auth, students, metrics, notify, assist, config routes)
		routes.*.ts             # Route modules
		auth/                   # JWT signing + middleware
		prisma/                 # Prisma client & migrations (SQLite dev DB)
		util/                   # Risk and CSV helpers
	tests/                    # Vitest + Supertest integration tests
	prisma/                   # Schema + migrations (some fallback raw SQL used during rapid proto)
README.md                   # This file
```


## Backend API

Base URL: http://localhost:5000

- GET /health
	- Returns API status and model load info.

- GET /api/students
	- Returns enriched student records with risk annotations and small histories.
	- Query params (optional):
		- search: string (by name)
		- risk: "High Risk|Medium Risk|Low Risk" (pipe or comma separated)
		- attendance_min: number
		- assignment_min: number (fraction 0..1 of assignments submitted)
		- fees_paid: "1" to filter paid-only
		- sort_by: column name, sort_dir: asc|desc
		- page, page_size

- POST /api/train
	- Trains a multiclass Logistic Regression on the current dataset; persists model as latest.pkl under backend/models.

- POST /api/predict
	- Body: { students: [ { attendance_percentage, avg_test_score, assignments_submitted, total_assignments, fees_paid }, ... ] }
	- Returns predictions and probability distribution per class.

- POST /api/schedule_retrain
	- Body: { interval_seconds: number } with minimum 60.
	- Starts a background thread to retrain periodically.

- POST /api/stop_retrain
	- Stops the background retrain thread.

- POST /api/regenerate_dataset
	- Body (optional): { num_students?: number, seed?: number }
	- Generates a fresh synthetic dataset, writes backend/student_data.csv, and retrains the model. Returns metrics and new model version.

Notes
- The server attempts to autoload latest trained model on startup from backend/models/latest.pkl.
- Risk enrichment uses default thresholds but can be overridden via query params when called within a request.


## Frontend

Tech: React 19, Vite 7, MUI 7.

- Vite dev proxy is configured in `PathKeeper/frontend/vite.config.js`:
	- `/api` -> BACKEND_URL (defaults to http://localhost:5000)
- Centralized endpoints in `PathKeeper/frontend/src/api.ts`.
- Pages & UI:
	- Overview: dashboard with students and metrics.
	- Notifications: placeholder with badge in the sidebar.
	- Settings: dark mode toggle and one-click dataset regenerate + retrain.
- Sidebar:
	- Floating glassmorphism nav rail with hamburger toggle (state persists in localStorage).
	- Micro-interactions for active pills using easing transitions.
	- Drop-shadow “bloom” under the rail for depth.
	- Notifications item shows a small badge as an example counter.


## Environment variables

Backend
- HOST (default 0.0.0.0)
- PORT (default 5000)
- FLASK_DEBUG (default 1; set to 0 for production-like run)

Frontend
- BACKEND_URL (for Vite proxy; default http://localhost:5000)
- VITE_API_BASE (optional; default "/api")


## Common tasks

- Train a model manually
	- POST http://localhost:5000/api/train

- Regenerate dataset and retrain
	- POST http://localhost:5000/api/regenerate_dataset

- Predict for new students
	- POST http://localhost:5000/api/predict
	- Body example:
		```json
		{
			"students": [
				{
					"attendance_percentage": 72,
					"avg_test_score": 68,
					"assignments_submitted": 6,
					"total_assignments": 10,
					"fees_paid": 1
				}
			]
		}
		```


## Troubleshooting

- Frontend port already in use
	- The dev server will auto-switch, e.g., 5173 -> 5174. Use the URL it prints.

- CORS or API proxy issues
	- Ensure backend is running at http://localhost:5000 or set `BACKEND_URL` in `vite.config.js` via environment.

- Sidebar compile error (resolved)
	- If you previously saw "Unterminated JSX" or "return outside of function" in `Sidebar.tsx`, the component has been rewritten properly. Make sure your dev server restarts and picks up changes.

- Missing Python deps
	- Run `pip install -r PathKeeper/backend/requirements.txt`.


## License

For demo and prototype use.

---

## Node Application / Auth Backend API (backend-node)

Base URL: http://localhost:5080 (configurable via PORT)

Auth
- POST /api/login { email, password } -> { token, user }
- GET /api/auth/me (Bearer token) -> user profile
- PATCH /api/auth/me -> update name/email
- POST /api/auth/me/password -> change password

Students & 360
- GET /api/students (future filtering/paging improvements TBD)
- GET /api/students/:id/360 -> aggregated profile (notes, assignments, meetings, risk trend synth)

Mentoring / Interventions
- POST /api/playbooks/assign (planned or prototype wrapper)
- POST /api/notes (add mentor note)
- Meetings endpoints (create/list/cancel) scaffolded for scheduling UI.

Notifications
- POST /api/notify { channel, recipients, body, subject?, studentId? }
	- channel: "email" | "sms" (sms placeholder)
	- recipients: string[] (required, >=1)
	- Logs to NotificationLog (or in-memory fallback).

AI Assist (Draft Generation)
- POST /api/assist/draft { contextType, tone?, hints? }
	- Returns { ok:true, draft:string } with a placeholder LLM simulation.
	- Frontend uses this to pre-fill outreach messages; user can edit before sending.

Risk Model Configuration
- GET /api/admin/config/risk-model -> { ok, config }
	- If none active, creates default weights & thresholds.
- PUT /api/admin/config/risk-model { weights:{...}, thresholds:{...} }
	- Versions the config (deactivates old, inserts new active record).
	- Current rapid prototype uses a raw-SQL fallback table if Prisma model generation isn’t complete (due to JSON field limitations in SQLite); migrating to Postgres or replacing JSON with TEXT is recommended for production.

Analytics (Admin)
- GET /api/admin/metrics/overview -> { ok, overview: { studentsTotal, highRisk, mediumRisk, lowRisk, playbookAssignmentsActive, meetingsUpcoming, notesLast7d, avgRisk } }
- GET /api/admin/metrics/risk-trend?days=30 -> { ok, trend: [ { date, avgRisk, highCount, mediumCount, lowCount } ... ] }
- GET /api/admin/metrics/interventions/effectiveness -> { ok, effectiveness: { totals, completionRate, avgCompletionDays, meetingCompletionRate } }

CSV Import (Prototype)
- POST /api/students/import (raw CSV or processed) — ingestion helper (front-end drag & drop). Validation & conflict resolution WIP.

---

## Notification Workflow (End-to-End)
1. Mentor/Admin selects students in dashboard.
2. Opens Notification Modal.
3. (Optional) Clicks “Suggest via AI” -> calls /api/assist/draft to get a tailored starting message.
4. Edits message, chooses channel (email / sms) and sends -> /api/notify.
5. Backend logs each recipient entry (status queued -> sent placeholder) in NotificationLog.

Error Handling
- Missing recipients -> 400.
- Unsupported channel -> 400.
- Internal failure -> 500 (frontend surfaces toast).

---

## AI Assist Draft Endpoint
POST /api/assist/draft
Request: { contextType: string, tone?: string, hints?: string[] }
Response: { ok:true, draft:string }
Implementation is currently deterministic / template-based placeholder; swap with LLM provider (Gemini, OpenAI) by injecting provider in assist route handler.

---

## Risk Model Configuration
Data Shape
weights: { attendance:number, gpa:number, assignments:number, notes:number, ... }
thresholds: { high:number, medium:number }

Fallback Storage
If Prisma model RiskModelConfig not generated (JSON not supported in chosen SQLite build), route uses raw SQL table creation and JSON string serialization. Replace with:
- Postgres + Prisma JSON fields OR
- Convert JSON to TEXT columns and parse manually.

Versioning Strategy
PUT deactivates old active rows and inserts new row with incremented version.

---

## Risk Snapshots (New)

Every time academic indicators are updated (PATCH /api/students/:id) or a student is imported with an inferred or explicit risk score, a point-in-time entry is written to the lightweight `RiskSnapshot` table (raw SQL ensured at runtime). This enables future historical trend charts without needing to backfill from logs.

Schema (SQLite raw):
```
id TEXT PK
studentId TEXT (FK Student)
riskScore REAL
createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
source TEXT ("academic_update" | "import")
```

Current Uses:
- Audit / validation via tests (riskSnapshot.test.ts)
- Basis for future real trend endpoint (currently trend in 360 view is synthetic placeholder)

Planned Enhancements:
- Add index on (studentId, createdAt) (already ensured)
- Expose `/api/students/:id/risk-history` returning chronological snapshots
- Optional retention or compression policy.

---

## CSV Import: Academic Metrics & Risk Inference (New)

The student import endpoint (`POST /api/students/import`) now accepts extended academic columns. On dry run it validates and, if `riskScore` is missing, infers a provisional risk using the active risk model weights. On real import it persists academic metrics to dynamic columns (ensured at runtime if migration hasn’t applied) and writes a `RiskSnapshot` if a risk score (explicit or inferred) exists.

Supported Columns (header names):
| Column | Required | Notes |
|--------|----------|-------|
| studentCode | yes | Unique institutional ID |
| name | yes | Student full name |
| email | yes | Lowercased during import |
| program | no | Free-text program/stream |
| year | no | Integer 0–12 |
| attendancePercent | no | 0–100 number |
| cgpa | no | 0–10 number |
| assignmentsCompleted | no | Integer >=0 |
| assignmentsTotal | no | Integer >=0 (used with assignmentsCompleted) |
| subjects | no | Comma or semicolon separated list (stored JSON) |
| mentorAcademicNote | no | Text (keyword scanned for penalty) |
| riskScore | no | 0–1 decimal; if absent risk is inferred when enough metrics present |

Risk Inference Heuristic (import):
```
attComp = 1 - attendancePercent/100 (else 0.5 if missing)
gpaComp = 1 - cgpa/10 (else 0.5)
assignComp = 1 - (assignmentsCompleted / max(1, assignmentsTotal)) (else 0.5)
notePenalty = 1 if mentorAcademicNote matches /(fail|risk|struggl|drop|absent)/i else 0
weighted = attComp*w.attendance + gpaComp*w.gpa + assignComp*w.assignments + notePenalty*w.notes
riskScore = clamp(weighted / sum(weights), 0, 1)
```
Weights come from active `RiskModelConfig` (raw SQL table) or default fallback `{attendance:0.35,gpa:0.35,assignments:0.2,notes:0.1}`.

Dry Run Behavior:
- Returns inferred riskScore in `rows[]` for preview (not persisted).
- Validation errors reported with line numbers; import must be re-run without `dryRun` to persist.

Runtime Column Assurance:
The backend auto-adds columns to `Student` (attendancePercent, cgpa, assignmentsCompleted, assignmentsTotal, subjectsJson, mentorAcademicNote, lastAcademicUpdate) if they are missing (SQLite `ALTER TABLE`).

Testing:
- `tests/import.academics.test.ts` covers dry-run inference & real persistence.

---

## Listing Students: includeUnassigned (Mentor/Counselor) (New)

`GET /api/students?includeUnassigned=1` allows mentors and counselors to see both their assigned and currently unassigned students (filtering occurs after fetching to avoid changing existing pagination semantics). Without the flag they only see students where `mentorId` equals their user id.

---

## Continuous Integration (New)

A minimal GitHub Actions workflow (`.github/workflows/ci.yml`) runs backend-node tests on push / pull request:
```
name: CI
on: [push, pull_request]
jobs:
	backend-node:
		runs-on: ubuntu-latest
		steps:
			- uses: actions/checkout@v4
			- uses: actions/setup-node@v4
				with:
					node-version: 18
			- run: npm ci --prefix PathKeeper/backend-node
			- run: npm test --prefix PathKeeper/backend-node
```

Add a badge after initial green run:
```
![CI](https://github.com/<org>/<repo>/actions/workflows/ci.yml/badge.svg)
```

---

## Updated Test Coverage (Delta)

Added:
- Risk snapshot insertion test (`riskSnapshot.test.ts`)
- Academic import + risk inference test (`import.academics.test.ts`)

Enhanced Confidence Areas:
- Risk model config versioning & retrieval
- Import validation & inference
- Academic field update recalculations and snapshot emission

Next Recommended Tests:
- Student listing with includeUnassigned flag (mentor scope)
- 360 endpoint includes academic fields
- Negative keyword note penalty path on PATCH (explicit assertions)

---

---

## Academic Indicators & Mentor Editing
Mentors (and admins) can update key academic engagement fields that feed directly into the dynamic risk score.

Editable Fields (PATCH /api/students/:id):
- attendancePercent (0–100)
- cgpa (0–10 scale)
- assignmentsCompleted (integer >=0)
- assignmentsTotal (integer >=0)
- subjects (array of { name, score? } – stored internally as JSON)
- mentorAcademicNote (free text; keyword scanning for negative indicators)

Risk Recalculation Heuristic (prototype):
```
attComponent      = 1 - attendancePercent/100
cgpaComponent     = 1 - cgpa/10
assignComponent   = 1 - (assignmentsCompleted / max(1, assignmentsTotal))
notePenalty       = 0.1 if mentorAcademicNote contains fail|risk|struggl|drop|absent (case-insensitive) else 0
riskScore = clamp(attComponent*0.35 + cgpaComponent*0.35 + assignComponent*0.20 + notePenalty, 0, 1)
```

Derived tier uses configured thresholds (default high>=0.7, medium>=0.4 else low). Updates set `lastRiskUpdated` & `lastAcademicUpdate`.

Student 360 Endpoint (/api/students/:id/360) now includes:
```
academics: {
	attendancePercent,
	cgpa,
	assignmentsCompleted,
	assignmentsTotal,
	subjects: [{ name, score? }],
	mentorAcademicNote,
	lastAcademicUpdate
}
```

Frontend Manage Students Page:
- Grid of assigned students with risk badges and academic chips.
- Drawer editor for the fields above.
- Optimistic UI risk badge update after save.

Implementation Notes:
- SQLite fallback adds missing columns at runtime if migration not applied.
- Subjects list input format: `Name[:score], Name2[:score2]` comma separated.
- Future improvement: server-side validation & audit logging for each academic change.

---

## Running Tests (backend-node)
Prereqs: Node 18+, SQLite (bundled).

Install deps:
```
cd PathKeeper/backend-node
npm install
```

Run all tests:
```
npm test
```

Focused test (e.g. analytics):
```
npm test -- -t analytics
```

Current Coverage (high-level):
- Risk model config (GET/PUT, versioning)
- Notifications (validation)
- AI Assist draft
- Analytics overview, trend, effectiveness
- Risk tier calculation

Suggested Next Additions:
- Import endpoint validation
- Student 360 endpoint shape
- Auth flows (login, profile update, password change)

---

## Environment Variables (backend-node)
| Variable | Default | Purpose |
|----------|---------|---------|
| PORT | 5080 | HTTP port |
| JWT_SECRET | dev_jwt_secret | HMAC signing key (change in prod) |
| DATABASE_URL | file:./dev.db | SQLite dev database |
| LOG_LEVEL | info | Logging verbosity |
| NODE_ENV | development | Affects logging + caching |

Frontend additional (when using Node backend for auth):
- VITE_AUTH_API_BASE=http://localhost:5080/api/auth
- BACKEND_URL=http://localhost:5000 (Flask ML service) or if unified later, single origin.

---

## Frontend Integration Highlights
Mentor Dashboard: Playbook assignments, notes, quick actions, bulk selection.
Student 360 Dialog: Real-time aggregated view with risk trend & counseling timeline.
Admin Command Center: Analytics panels + risk model configuration + dataset import drag & drop.
Notifications & AI Assist: Modal with AI draft suggestion, message review, dispatch.

---

## Roadmap (Potential Enhancements)
- Replace placeholder AI assist with real LLM service + caching.
- Historical risk snapshot table for true trend (instead of synthetic variation).
- Unified migration to Postgres (JSON support, better concurrency, indexing).
- WebSocket / SSE live updates for notifications and meeting scheduling.
- Role-based granular permissions & audit expansion.
- Automated import validation (schema inference, diff preview, rollback).

---

## Troubleshooting (Extended)
BigInt Serialization Error:
- Was mitigated by sanitizing BigInt -> Number in analytics route.
Prisma Model Mismatch:
- If schema changes and client not regenerated, run `npx prisma generate`. Raw fallbacks cover some gaps temporarily.
Notifications Not Appearing:
- Check logs for /api/notify 400 (missing recipients) or 500; verify request has `recipients` array.

---

## License

For demo and prototype use.
