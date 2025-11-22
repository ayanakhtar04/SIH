import * as JWT from 'jsonwebtoken';

import { ENV } from '../config/env';
import { User } from '../types';

export interface JwtPayload {
  sub: string;
  role: User['role'] | 'student';
  email: string;
  kind?: 'user' | 'student';
  iat?: number;
  exp?: number;
}

export function signUser(user: User, opts?: { expiresIn?: string | number; kind?: 'user' | 'student' }): string {
  const payload: JwtPayload = {
    sub: user.id,
    role: user.role,
    email: user.email,
    kind: opts?.kind || 'user'
  };
  const secret = ENV.JWT_SECRET as JWT.Secret;
  const exp = opts?.expiresIn || '2h';
  return JWT.sign(payload as object, secret, { expiresIn: exp } as JWT.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return JWT.verify(token, ENV.JWT_SECRET as JWT.Secret) as JwtPayload;
}
