import crypto from 'crypto';

import { User } from '../types/index';

// Simple in-memory user store for initial scaffolding only.
// This will be replaced by a real database layer in later phases.

const now = new Date();

export const users: User[] = [
  {
    id: crypto.randomUUID(),
    email: 'admin@pathkeepers.local',
    name: 'Platform Admin',
    role: 'admin',
    // password: Admin@123 (seed)
    passwordHash: '$2a$10$8hKj1p.cq3TB4OxkHT6YpOivH0b3bNncX7Sn5BsMI9mqlJp7Yyn2G',
    createdAt: now
  }
];

export function findUserByEmail(email: string): User | undefined {
  return users.find(u => u.email.toLowerCase() === email.toLowerCase());
}
