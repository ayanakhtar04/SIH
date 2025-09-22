export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'counselor' | 'viewer';
  passwordHash: string; // Placeholder until real auth
  createdAt: Date;
}
