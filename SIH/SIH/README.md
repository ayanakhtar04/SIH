# PathKeepers (SIH)

An end-to-end prototype for student risk monitoring and interventions.

- Backend: Flask API that generates synthetic student data, trains a multiclass ML model (Low/Medium/High Risk), and serves endpoints for data, training, prediction, notifications, and dataset regeneration.
- Frontend: React + Vite + MUI dashboard with a modern glassmorphism sidebar, dark mode, overview metrics, notifications, and a Settings page with one-click "Generate New Dataset & Retrain".


## Quick start

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


## Project structure

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
