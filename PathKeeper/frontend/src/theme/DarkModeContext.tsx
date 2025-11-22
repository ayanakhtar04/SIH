import React from 'react';

export interface DarkModeContextShape {
  dark: boolean;
  toggleDark: () => void;
  setDark: (v: boolean) => void;
}

export const DarkModeContext = React.createContext<DarkModeContextShape | undefined>(undefined);

export const useDarkMode = () => {
  const ctx = React.useContext(DarkModeContext);
  if (!ctx) throw new Error('useDarkMode must be used within DarkModeProvider');
  return ctx;
};

export const DarkModeProvider: React.FC<{ value: DarkModeContextShape; children: React.ReactNode }> = ({ value, children }) => (
  <DarkModeContext.Provider value={value}>{children}</DarkModeContext.Provider>
);
