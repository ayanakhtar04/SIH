import { StrictMode, useEffect, useMemo, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import './index.css';
import Sidebar from './components/Sidebar';
import Overview from './pages/Overview';
import Settings from './pages/Settings';
import App from './App';
import Notifications from './pages/Notifications';
import { Box, Fab, Paper } from '@mui/material';
import OverviewPage from './pages/OverviewPage';

function usePersistentState(key, initial) {
  const [val, setVal] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw != null ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* no-op */ }
  }, [key, val]);
  return [val, setVal];
}

export function Shell() {
  const [dark, setDark] = usePersistentState('pk.dark', false);
  const [navOpen, setNavOpen] = usePersistentState('pk.navOpen', true);
  const theme = useMemo(() => {
    if (dark) {
      // Exact dark theme colors requested
      const COLOR_BG = '#1A1A1A';          // Near-Black base
      const COLOR_SURFACE = '#2C2C2C';     // Dark Charcoal surface
      const COLOR_TEXT = '#E0E0E0';        // Light Grey (primary text)
      const COLOR_TEXT_SECONDARY = '#BDBDBD';
      const COLOR_ACCENT = '#B85C4F';      // Terracotta Red accent
      const background = { default: COLOR_BG, paper: COLOR_SURFACE };
      return createTheme({
        palette: {
          mode: 'dark',
            primary: { main: COLOR_ACCENT, contrastText: COLOR_TEXT },
            secondary: { main: '#D07A6E' },
            background,
            text: { primary: COLOR_TEXT, secondary: COLOR_TEXT_SECONDARY },
            divider: '#3a3a3a'
        },
        typography: {
          fontFamily: 'Poppins, Roboto, Helvetica, Arial, sans-serif'
        },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              ':root': {
                '--pk-bg': COLOR_BG,
                '--pk-surface': COLOR_SURFACE,
                '--pk-text': COLOR_TEXT,
                '--pk-text-secondary': COLOR_TEXT_SECONDARY,
                '--pk-accent': COLOR_ACCENT,
              },
              body: {
                backgroundColor: COLOR_BG,
                color: COLOR_TEXT,
                WebkitFontSmoothing: 'antialiased',
              },
              '::-webkit-scrollbar': { width: '8px' },
              '::-webkit-scrollbar-thumb': { background: '#444', borderRadius: 4 },
              '::-webkit-scrollbar-track': { background: '#1f1f1f' },
            }
          },
          MuiPaper: {
            styleOverrides: { root: { backgroundColor: COLOR_SURFACE } }
          },
          MuiAppBar: {
            styleOverrides: { root: { backgroundImage: 'none', backgroundColor: COLOR_SURFACE, color: COLOR_TEXT } }
          },
          MuiTooltip: {
            styleOverrides: { tooltip: { backgroundColor: '#222', color: COLOR_TEXT, fontSize: '0.7rem' } }
          },
          MuiButton: {
            styleOverrides: {
              root: {
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: 8,
                '&.MuiButton-containedPrimary': { boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }
              }
            }
          },
          MuiIconButton: {
            styleOverrides: { root: { borderRadius: 10 } }
          },
          MuiChip: {
            styleOverrides: { root: { fontWeight: 500 } }
          }
        }
      });
    } else {
      // Light mode: Calm Green and Neutral (forest green, off-white, slate blue)
      const background = { default: '#F7F7F5', paper: '#FFFFFF' };
      const text = { primary: '#1F2937', secondary: '#475569' };
      return createTheme({
        palette: {
          mode: 'light',
          primary: { main: '#2E7D32' }, // Forest Green
          secondary: { main: '#5B7C99' }, // Slate Blue
          background,
          text,
        },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              body: {
                backgroundColor: background.default,
                color: text.primary,
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundColor: background.paper,
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
                backgroundColor: '#FFFFFF',
                color: text.primary,
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: { textTransform: 'none', fontWeight: 600 },
            },
          },
        },
      });
    }
  }, [dark]);
  // Reference to App component to trigger reload
  const appRef = useRef(null);
  // Helper to reload students in App
  const reloadStudents = () => {
    if (appRef.current && appRef.current.reloadStudents) {
      appRef.current.reloadStudents();
    }
  };
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh' }}>
  <Sidebar open={navOpen} onToggle={(v)=> setNavOpen(v)} />
        {/* floating hamburger removed per UX request */}
  <Box sx={{ pl: { xs: 2, sm: navOpen ? '305px' : '95px' }, pr: 2, pt: 8, pb: 2, transition: 'padding-left 250ms ease' }}>
          <Routes>
            <Route path="/" element={<Overview appRef={appRef} navOpen={navOpen} />} />
            <Route path="/new-overview" element={<OverviewPage />} />
            <Route path="/settings" element={<Settings dark={dark} onToggleDark={() => setDark(v => !v)} reloadStudents={reloadStudents} />} />
            {/* Invoices and Wallet routes removed */}
            <Route path="/notifications" element={<Notifications />} />
          </Routes>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  </StrictMode>
);
