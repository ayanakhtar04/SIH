import { createTheme, Theme } from '@mui/material/styles';

export function buildTheme(dark: boolean): Theme {
  if (dark) {
    const COLOR_BG = '#1A1A1A';
    const COLOR_SURFACE = '#2C2C2C';
    const COLOR_TEXT = '#E0E0E0';
    const COLOR_TEXT_SECONDARY = '#BDBDBD';
    const COLOR_ACCENT = '#B85C4F';
    return createTheme({
      palette: {
        mode: 'dark',
        primary: { main: COLOR_ACCENT },
        background: { default: COLOR_BG, paper: COLOR_SURFACE },
        text: { primary: COLOR_TEXT, secondary: COLOR_TEXT_SECONDARY }
      },
      typography: { fontFamily: 'Poppins, Roboto, Helvetica, Arial, sans-serif' },
      shape: { borderRadius: 16 },
      components: {
        MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
        MuiButton: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600, borderRadius: 30 } } },
        MuiTextField: { styleOverrides: { root: { borderRadius: 20 } } }
      }
    });
  }
  // Light
  return createTheme({
    palette: {
      mode: 'light',
      primary: { main: '#2E7D32' },
      background: { default: '#F7F7F5', paper: '#FFFFFF' },
      text: { primary: '#1F2937', secondary: '#475569' }
    },
    typography: { fontFamily: 'Poppins, Roboto, Helvetica, Arial, sans-serif' },
    shape: { borderRadius: 16 },
    components: {
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiButton: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600, borderRadius: 30 } } }
    }
  });
}
