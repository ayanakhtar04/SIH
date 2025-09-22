export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'counselor' | 'viewer' | 'mentor';
  passwordHash: string; // Hashed password (never returned to frontend)
  createdAt: Date;
}
