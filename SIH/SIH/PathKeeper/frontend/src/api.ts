// Centralized API base and helpers
// Prefer explicit VITE_API_BASE (full URL or path). Fallback to proxy prefix /api.
// You can also set VITE_BACKEND_URL (e.g. http://localhost:5000) and we build endpoints directly.
const viteEnv: any = (import.meta as any).env || {};
const explicitBase = viteEnv.VITE_API_BASE;
const backendUrl = viteEnv.VITE_BACKEND_URL;
export const API_BASE = (explicitBase || (backendUrl ? `${backendUrl.replace(/\/$/, '')}/api` : '/api'));
export const API = {
  students: `${API_BASE.replace(/\/$/, '')}/students`,
  train: `${API_BASE.replace(/\/$/, '')}/train`,
  predict: `${API_BASE.replace(/\/$/, '')}/predict`,
  regenerate: `${API_BASE.replace(/\/$/, '')}/regenerate_dataset`,
  health: `/health`,
};
