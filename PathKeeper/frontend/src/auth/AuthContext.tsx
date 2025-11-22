import React from 'react';
import { decodeJwt } from './api';

interface Session { token: string; kind: 'student' | 'user'; role?: string; }
interface AuthCtx {
  session: Session | null;
  login: (s: Session) => void;
  logout: () => void;
  patchSession: (partial: Partial<Session>) => void;
}

const AuthContext = React.createContext<AuthCtx | undefined>(undefined);

const STORAGE_KEY = 'pk.session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = React.useState<Session | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const dec = decodeJwt(parsed.token);
      if (dec?.exp && Date.now() >= dec.exp * 1000) return null;
      return parsed;
    } catch { return null; }
  });

  React.useEffect(()=> {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  }, [session]);

  React.useEffect(()=> {
    if (!session) return;
    const dec = decodeJwt(session.token);
    if (!dec?.exp) return;
    const ms = dec.exp * 1000 - Date.now() - 500;
    if (ms <= 0) { setSession(null); return; }
    const id = setTimeout(()=> setSession(null), ms);
    return ()=> clearTimeout(id);
  }, [session]);

  const value: AuthCtx = {
    session,
    login: (s) => setSession(s),
    logout: () => setSession(null),
    patchSession: (partial) => setSession(prev => prev ? { ...prev, ...partial } : prev)
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
