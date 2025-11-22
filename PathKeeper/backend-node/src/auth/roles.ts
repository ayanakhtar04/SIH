// Central role definitions. 'mentor' is added; 'viewer' typically for basic read-only accounts (e.g. students).
export type Role = 'admin' | 'counselor' | 'viewer' | 'mentor';

export function isAdmin(role?: string): boolean {
  return role === 'admin';
}

export function isCounselor(role?: string): boolean {
  return role === 'counselor';
}

export function isViewer(role?: string): boolean {
  return role === 'viewer';
}

export function isMentor(role?: string): boolean {
  return role === 'mentor' || role === 'teacher'; // 'teacher' kept for backward-compat tokens
}

export function requireAdmin(role?: string) {
  if (!isAdmin(role)) throw new Error('forbidden');
}