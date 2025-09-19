import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  Box,
  Stack,
  Button,
  Divider,
  CircularProgress,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  Drawer,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
} from '@mui/material';
import { keyframes } from '@emotion/react';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { API } from './api';

interface Student {
  student_id: number;
  name: string;
  attendance_percentage: number;
  avg_test_score: number;
  assignments_submitted: number;
  total_assignments: number;
  fees_paid: number;
  risk_level: string;
  risk_color?: string;
  risk_reasons?: string[];
  attendance_history?: number[];
  score_history?: number[];
}

interface StudentsApiResponse {
  data: Student[];
  total: number;
  page: number;
  page_size: number;
}

const MIN_SPLASH_MS = 900;

type AppRef = { reloadStudents: () => void };
interface AppProps { navOpen?: boolean }

const App = React.forwardRef<AppRef, AppProps>(({ navOpen = true }, ref) => {
  const [students, setStudents] = useState<Student[]>([]);
  const theme = useTheme();
  const accent = theme.palette.primary.main;
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20); // fixed page size
  // Thresholds used for backend defaults (no UI controls in prototype)
  const attHigh = 70;
  const scoreHigh = 50;
  const attMed = 80;
  const scoreMed = 60;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [minTimePassed, setMinTimePassed] = useState(false);
  const showSplash = loading || !minTimePassed;

  // Filters and sorting
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<'All' | 'High' | 'Medium' | 'Low'>('All');
  const [attendanceMin] = useState<number>(0);
  const [minAssignRatio] = useState<number>(0);
  const [feesPaidOnly] = useState(false);

  const [orderBy, setOrderBy] = useState<'attendance' | 'score' | 'assignments'>('attendance');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  // ML UI state
  const [training, setTraining] = useState(false);
  const [trainInfo, setTrainInfo] = useState<{ accuracy?: number; macro_f1?: number; version?: number; classes?: string[]; cm?: number[][]; perClass?: Record<string, { precision: number; recall: number; f1: number }>; } | null>(null);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [predMap, setPredMap] = useState<Record<number, { probabilities: Record<string, number>; predicted: string; version: number }>>({});

  useEffect(() => {
    const timer = setTimeout(() => setMinTimePassed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  // Expose reloadStudents to parent via ref
  React.useImperativeHandle(ref, () => ({
    reloadStudents: () => fetchStudents()
  }));

  function fetchStudents() {
    setLoading(true);
    const url = `${API.students}?page=${page}&page_size=${pageSize}&att_high=${attHigh}&score_high=${scoreHigh}&att_med=${attMed}&score_med=${scoreMed}`;
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`Status: ${res.status}`);
        return res.json();
      })
      .then(json => {
        if (Array.isArray(json)) {
          setStudents(json);
          setTotalCount(json.length);
        } else {
          const typed = json;
          setStudents(typed.data || []);
          setTotalCount(typed.total || (typed.data ? typed.data.length : 0));
        }
        setError(null);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Unknown error'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchStudents();
    // eslint-disable-next-line
  }, [page, pageSize, attHigh, scoreHigh, attMed, scoreMed]);

  // Animated pulse ring
  const ping = keyframes`
    0% { transform: scale(1); opacity: .7; }
    70% { transform: scale(2.2); opacity: 0; }
    100% { transform: scale(2.2); opacity: 0; }
  `;

  const RiskIndicator = ({ level }: { level: string }) => {
    const lower = (level || '').toLowerCase();
    const isHigh = lower.includes('high');
    const isMed = lower.includes('medium') || lower.includes('mid');
    const isLow = lower.includes('low');
    const color = isHigh
      ? 'error.main'
      : isMed
      ? 'warning.main'
      : isLow
      ? 'success.main'
      : 'grey.500';
    const label = isHigh ? 'High' : isMed ? 'Medium' : isLow ? 'Low' : level;
    const duration = isHigh ? '1.1s' : isMed ? '1.6s' : isLow ? '2.2s' : '1.6s';

    return (
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
        <Box sx={{ position: 'relative', width: 12, height: 12, color }} aria-label={`Risk ${label}`}>
          <Box sx={{ position: 'absolute', inset: 0, borderRadius: '50%', bgcolor: 'currentColor' }} />
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '2px solid currentColor',
              animation: `${ping} ${duration} ease-out infinite`,
            }}
          />
        </Box>
        <Typography variant="caption" sx={{ fontWeight: 700, color }}>{label} Risk</Typography>
      </Stack>
    );
  };

  const CheckIcon = (
    <Box component="span" sx={{ color: 'success.main', fontSize: 18, fontWeight: 700 }}>✓</Box>
  );
  const CrossIcon = (
    <Box component="span" sx={{ color: 'error.main', fontSize: 18, fontWeight: 700 }}>✗</Box>
  );

  const trainModel = async () => {
    try {
      setTraining(true);
      const res = await fetch(API.train, { method: 'POST' });
      if (!res.ok) throw new Error(`Train failed (${res.status})`);
      const json = await res.json();
      const accuracy = json.overall?.accuracy ?? json.metrics?.accuracy;
      const macro_f1 = json.overall?.macro_f1 ?? json.metrics?.f1;
      setTrainInfo({
        accuracy,
        macro_f1,
        version: json.version,
        classes: json.classes,
        cm: json.confusion_matrix,
        perClass: json.per_class,
      });
      setMetricsOpen(true);
    } catch (e) {
      alert('Training error');
    } finally {
      setTraining(false);
    }
  };

  const predictSelected = async () => {
    const s = students.find((x) => x.student_id === selectedId);
    if (!s) return alert('Select a student first');
    try {
      const body = {
        students: [{
          attendance_percentage: s.attendance_percentage,
          avg_test_score: s.avg_test_score,
          assignments_submitted: s.assignments_submitted,
          total_assignments: s.total_assignments,
          fees_paid: s.fees_paid,
        }]
      };
      const res = await fetch(API.predict, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Predict failed');
      const json = await res.json();
      const r = (json.results && json.results[0]) || null;
      if (r) {
        setPredMap((prev) => ({
          ...prev,
          [s.student_id]: {
            probabilities: r.probabilities || {},
            predicted: r.predicted_risk,
            version: json.version || 0,
          }
        }));
      }
    } catch (e) {
      alert('Prediction error');
    }
  };

  // Derived data
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = students.filter((s) => {
    const matchesSearch = normalizedSearch
      ? `${s.student_id}`.includes(normalizedSearch) || s.name.toLowerCase().includes(normalizedSearch)
      : true;
    const matchesRisk =
      riskFilter === 'All' ? true : s.risk_level.toLowerCase().includes(riskFilter.toLowerCase());
    return matchesSearch && matchesRisk;
  });

  const sorted = [...filtered].sort((a, b) => {
    const dir = order === 'asc' ? 1 : -1;
    if (orderBy === 'attendance') return (a.attendance_percentage - b.attendance_percentage) * dir;
    if (orderBy === 'score') return (a.avg_test_score - b.avg_test_score) * dir;
    const aRatio = a.assignments_submitted / Math.max(1, a.total_assignments);
    const bRatio = b.assignments_submitted / Math.max(1, b.total_assignments);
    return (aRatio - bRatio) * dir;
  });

  const cohort = sorted.reduce(
    (acc, s) => {
      const k = s.risk_level.includes('High') ? 'high' : s.risk_level.includes('Medium') ? 'med' : 'low';
      acc[k] += 1;
      return acc;
    },
    { high: 0, med: 0, low: 0 }
  );

  // Reusable logo with fallback to vite.svg if custom logo not present
  const LogoImg = ({ size = 40 }: { size?: number }) => {
    const [src, setSrc] = useState('/pathkeepers-logo.png');
    return (
      <Box
        component="img"
        src={src}
        alt="PathKeepers logo"
        onError={() => setSrc('/vite.svg')}
        sx={{ width: size, height: size, objectFit: 'contain' }}
      />
    );
  };

  // derive a page title from the current route
  const location = useLocation();
  const pageTitle = (() => {
    const p = location?.pathname || '/';
    if (p.startsWith('/settings')) return 'Settings';
    if (p.startsWith('/notifications')) return 'Notifications';
    if (p.startsWith('/new-overview')) return 'Overview';
    if (p === '/' || p === '') return 'Overview';
    // fallback: use the last path segment capitalized
    const seg = p.split('/').filter(Boolean).pop() || 'Overview';
    return seg.charAt(0).toUpperCase() + seg.slice(1);
  })();

  // Simple inline sparkline component
  const Sparkline = ({ title, data, color }: { title: string; data: number[]; color: string }) => {
    if (!data || data.length === 0) return null;
    const chartData = data.map((v, i) => ({ i, v }));
    return (
      <Box>
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>{title}</Typography>
        <Box sx={{ width: 200, height: 60 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 6, bottom: 0, left: 0 }}>
              <XAxis dataKey="i" hide />
              <YAxis hide domain={[0, 100]} />
              <Tooltip formatter={(value: number) => `${value}%`} labelFormatter={(l) => `Week ${l}`} />
              <Line type="monotone" dataKey="v" stroke={color} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </Box>
    );
  };

  // Animations
  const fadeSlideIn = keyframes`0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:none}`;
  const paperEnter = keyframes`0%{opacity:0;transform:translateY(12px) scale(.985)}100%{opacity:1;transform:none}`;
  const shimmer = keyframes`0%{background-position:0% 50%}100%{background-position:200% 50%}`;
  const pulseBorder = keyframes`0%{box-shadow:0 0 0 0 rgba(184,92,79,0.4)}70%{box-shadow:0 0 0 6px rgba(184,92,79,0)}100%{box-shadow:0 0 0 0 rgba(184,92,79,0)}`;

  // Count up component for dynamic numbers
  const CountUp: React.FC<{ value: number; duration?: number }> = ({ value, duration = 800 }) => {
    const [display, setDisplay] = useState(0);
    useEffect(() => {
      let start: number | null = null; let raf: number;
      const from = 0; const to = value;
      const step = (ts: number) => {
        if (start === null) start = ts;
        const prog = Math.min((ts - start) / duration, 1);
        const eased = 1 - Math.pow(1 - prog, 3); // easeOutCubic
        setDisplay(Math.round(from + (to - from) * eased));
        if (prog < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      return () => cancelAnimationFrame(raf);
    }, [value, duration]);
    return <>{display}</>;
  };

  return (
    <>
      {trainInfo && (
        <Dialog open={metricsOpen} onClose={() => setMetricsOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle sx={{
            fontWeight: 800,
            background: (t)=> t.palette.mode==='dark'? 'linear-gradient(120deg,#2C2C2C,#262626,#2C2C2C)':'linear-gradient(120deg,#f8fafc,#eef2f7)',
            pb: 2,
            position:'relative'
          }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:1.5 }}>
              <Typography component="span" variant="h6" sx={{
                m:0,
                background:(t)=>`linear-gradient(90deg, ${t.palette.primary.main}, ${t.palette.primary.light})`,
                WebkitBackgroundClip:'text', color:'transparent'
              }}>Model Metrics</Typography>
              <Chip size="small" color="primary" label={`v${trainInfo.version ?? '?'}`} sx={{ fontWeight:600 }} />
              <Box sx={{ ml:'auto', display:'flex', gap:1, flexWrap:'wrap' }}>
                <Chip size="small" variant="outlined" color="success" label={`Accuracy ${trainInfo.accuracy?.toFixed(3) ?? '-'}`} />
                <Chip size="small" variant="outlined" color="secondary" label={`Macro F1 ${trainInfo.macro_f1?.toFixed(3) ?? '-'}`} />
              </Box>
            </Box>
          </DialogTitle>
          <DialogContent dividers sx={{
            background:(t)=> t.palette.mode==='dark' ? 'linear-gradient(145deg,#222,#262626 60%,#1d1d1d)' : 'linear-gradient(145deg,#fff,#f1f5f9)',
            pt:3
          }}>
            <Stack spacing={3}>
              {Array.isArray(trainInfo.classes) && Array.isArray(trainInfo.cm) && trainInfo.classes.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1.25, fontWeight:700, letterSpacing:.5 }}>Confusion Matrix</Typography>
                  <Box sx={{
                    display:'grid',
                    gridTemplateColumns: `repeat(${(trainInfo.classes?.length || 0) + 1}, 1fr)`,
                    gap: 0.75,
                    fontSize:'0.7rem'
                  }}>
                    <Box />
                    {trainInfo.classes!.map((c: string) => (
                      <Box key={`cm-head-${c}`} sx={{
                        textAlign:'center',
                        fontWeight:600,
                        px:1, py:0.5,
                        bgcolor:'rgba(255,255,255,0.05)',
                        borderRadius:1,
                        border:(t)=>`1px solid ${t.palette.divider}`
                      }}>Pred {c}</Box>
                    ))}
                    {(trainInfo.cm || []).map((row: number[], i: number) => (
                      <React.Fragment key={`cm-row-${i}`}>
                        <Box sx={{
                          fontWeight:600,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          px:1, py:0.5,
                          bgcolor:'rgba(255,255,255,0.05)',
                          borderRadius:1,
                          border:(t)=>`1px solid ${t.palette.divider}`
                        }}>True {trainInfo.classes?.[i]}</Box>
                        {row.map((val: number, j: number) => {
                          const isDiag = i === j;
                          return (
                            <Box key={`cm-cell-${i}-${j}`} sx={{
                              position:'relative',
                              textAlign:'center',
                              px:1, py:0.65,
                              borderRadius:1,
                              fontWeight:600,
                              border:(t)=>`1px solid ${t.palette.divider}`,
                              bgcolor: (t)=> isDiag ? t.palette.primary.main + '22' : 'rgba(255,255,255,0.04)',
                              overflow:'hidden'
                            }}>
                              <Box sx={{ position:'relative', zIndex:1 }}>{val}</Box>
                              {isDiag && (
                                <Box sx={{ position:'absolute', inset:0, background:(t)=>`linear-gradient(135deg, ${t.palette.primary.main}33, transparent 70%)`, zIndex:0 }} />
                              )}
                            </Box>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </Box>
                </Box>
              )}
              {trainInfo.perClass && trainInfo.classes && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1.25, fontWeight:700, letterSpacing:.5 }}>Per-class Metrics</Typography>
                  <Stack spacing={1}>
                    {trainInfo.classes.map((c: string) => {
                      const m = trainInfo.perClass?.[c];
                      const f1 = m?.f1 ?? 0;
                      return (
                        <Box key={`pc-row-${c}`} sx={{
                          p:1,
                          borderRadius:2,
                          border:(t)=>`1px solid ${t.palette.divider}`,
                          bgcolor:(t)=> t.palette.mode==='dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
                        }}>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb:0.5 }}>
                            <Chip size="small" label={c} color={c.includes('High') ? 'error' : c.includes('Low') ? 'success' : 'warning'} sx={{ fontWeight:600 }} />
                            <Typography variant="caption" sx={{ opacity:0.8 }}>P {m?.precision?.toFixed(3) ?? '-'} | R {m?.recall?.toFixed(3) ?? '-'} | F1 {m?.f1?.toFixed(3) ?? '-'}</Typography>
                          </Stack>
                          <Box sx={{ position:'relative', height:8, borderRadius:9999, bgcolor:'divider', overflow:'hidden' }}>
                            <Box sx={{ position:'absolute', inset:0, width: `${Math.min(1, f1) * 100}%`, bgcolor:(t)=> t.palette.primary.main, transition:'width 600ms cubic-bezier(.4,0,.2,1)' }} />
                          </Box>
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ justifyContent:'space-between', px:3, py:1.5 }}>
            <Typography variant="caption" sx={{ opacity:0.6 }}>Generated at {new Date().toLocaleTimeString()}</Typography>
            <Button onClick={() => setMetricsOpen(false)} variant="contained" color="primary" size="small" sx={{ fontWeight:600 }}>Close</Button>
          </DialogActions>
        </Dialog>
      )}

  <Box sx={{ minHeight: '100vh', bgcolor: (t) => t.palette.background.default }}>
        {/* Header */}
  <AppBar position="static" color="transparent" enableColorOnDark sx={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', backgroundColor: (t)=> t.palette.mode === 'dark' ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.6)', boxShadow: 'none', borderBottom: (t)=> `1px solid ${t.palette.divider}` }}>
          <Toolbar sx={{ py: 0.5, pl: { xs: 2, sm: navOpen ? '300px' : '110px' } }}>
            <Typography variant="h6" component="div" sx={{ fontWeight: 800, width: '100%', textAlign: 'left', pl: 0 }}>{pageTitle}</Typography>
          </Toolbar>
        </AppBar>

        {/* Main Content */}
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Paper elevation={0} sx={{
            overflow: 'hidden',
            borderRadius: 2.5,
            position: 'relative',
            background: (t)=> t.palette.mode==='dark'
              ? 'linear-gradient(145deg, #2C2C2C 0%, #262626 55%, #222 100%)'
              : 'linear-gradient(145deg, #FFFFFF 0%, #F5F7F7 70%, #F0F2F2 100%)',
            border: (t)=> `1px solid ${t.palette.mode==='dark' ? '#3a3a3a' : '#E2E8F0'}`,
            boxShadow: (t)=> t.palette.mode==='dark'
              ? '0 8px 24px -6px rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.4)'
              : '0 6px 18px -4px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)',
            animation: `${paperEnter} 640ms cubic-bezier(.4,0,.2,1)`,
            '&:focus-within': { animation: `${pulseBorder} 1.8s ease-out` }
          }}>
            <Box sx={{
              px: 3, py: 2.25,
              display: 'flex', alignItems: 'center', gap: 2,
              borderBottom: '1px solid', borderColor: 'divider',
              background: (t)=> t.palette.mode==='dark' ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.02)',
            }}>
              <Typography variant="h6" sx={{
                fontWeight: 800, letterSpacing: 0.4, position: 'relative',
                background: (t)=> `linear-gradient(90deg, ${t.palette.primary.main}, ${t.palette.primary.light}, ${t.palette.primary.main})`,
                backgroundSize: '200% 100%', WebkitBackgroundClip: 'text', color: 'transparent',
                animation: `${shimmer} 16s linear infinite`,
                '&:after': {
                  content: '""', position: 'absolute', left: 0, bottom: -6, height: 3, width: '100%',
                  background: (t)=> `linear-gradient(90deg, ${t.palette.primary.main}, transparent)`, borderRadius: 3,
                  transform: 'scaleX(0)', transformOrigin: '0 50%', animation: 'dashGrow 900ms 240ms cubic-bezier(.4,0,.2,1) forwards'
                }
              }}>Student Risk Overview</Typography>
              <style>{`@keyframes dashGrow{to{transform:scaleX(1)}}`}</style>
              <Box sx={{ ml: 'auto', display: { xs: 'none', sm: 'flex' }, gap: 1 }}>
                <Chip size="small" variant="outlined"
                  label={<Box sx={{ display:'flex', gap:.5, alignItems:'center'}}><Box component='span'>Total:</Box><CountUp value={totalCount} /></Box>} sx={{ fontWeight: 600 }} />
              </Box>
            </Box>

            {/* Controls & cohort summary wrapper */}
            <Box sx={{ px: 3, pt: 2.25, pb: 1.5, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
                <TextField
                  label="Search by name or ID"
                  size="small"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  sx={{ minWidth: 240, flexShrink: 0, '& .MuiInputBase-root': { borderRadius: 2 } }}
                />
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>Risk</InputLabel>
                  <Select label="Risk" value={riskFilter} onChange={(e) => setRiskFilter(e.target.value as any)} sx={{ borderRadius: 2 }}>
                    <MenuItem value="All">All</MenuItem>
                    <MenuItem value="High">High</MenuItem>
                    <MenuItem value="Medium">Medium</MenuItem>
                    <MenuItem value="Low">Low</MenuItem>
                  </Select>
                </FormControl>
                <Box sx={{ flexGrow: 1 }} />
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ '& .MuiChip-root': { fontWeight: 600, transition:'transform 180ms, box-shadow 180ms', '&:hover': { transform:'translateY(-2px)', boxShadow: 3 } } }}>
                  <Chip size="small" sx={{ bgcolor: 'error.dark', color: '#fff' }} label={<Box>High: <CountUp value={cohort.high} /></Box>} />
                  <Chip size="small" sx={{ bgcolor: 'warning.dark', color: '#1A1A1A' }} label={<Box>Medium: <CountUp value={cohort.med} /></Box>} />
                  <Chip size="small" sx={{ bgcolor: 'success.dark', color: '#fff' }} label={<Box>Low: <CountUp value={cohort.low} /></Box>} />
                </Stack>
              </Stack>
            </Box>

            {/* Error state */}
            {error && (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'error.main', mb: 1 }}>Error loading data</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{error}</Typography>
                <Button variant="outlined" size="small" onClick={()=> fetchStudents()}>Retry</Button>
              </Box>
            )}

            {!error && (
              <TableContainer sx={{ px: 2, pb: 1 }}>
                <Table size="small" aria-label="student risk table" sx={{
                  '& thead th': {
                    fontWeight: 600,
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    letterSpacing: '.5px',
                    borderBottom: (t)=> `1px solid ${t.palette.divider}`
                  },
                  '& tbody tr': {
                    transition: 'background 140ms, transform 140ms',
                  },
                  '& tbody tr:nth-of-type(even)': {
                    background: (t)=> t.palette.mode==='dark' ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.02)'
                  },
                  '& tbody tr:hover': {
                    background: (t)=> t.palette.mode==='dark' ? 'rgba(184,92,79,0.10)' : 'rgba(184,92,79,0.08)'
                  },
                  '& tbody tr.Mui-selected': {
                    background: (t)=> t.palette.mode==='dark' ? 'rgba(184,92,79,0.18)' : 'rgba(184,92,79,0.15)'
                  },
                }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(184,92,79,0.10)' : 'rgba(184,92,79,0.08)') }}>
                      <TableCell>Student ID</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell align="center" sortDirection={orderBy === 'attendance' ? order : (false as any)}>
                        <TableSortLabel active={orderBy === 'attendance'} direction={orderBy === 'attendance' ? order : 'asc'} onClick={() => { setOrderBy('attendance'); setOrder((o) => (o === 'asc' ? 'desc' : 'asc')); }}>
                          Attendance (%)
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="center" sortDirection={orderBy === 'score' ? order : (false as any)}>
                        <TableSortLabel active={orderBy === 'score'} direction={orderBy === 'score' ? order : 'asc'} onClick={() => { setOrderBy('score'); setOrder((o) => (o === 'asc' ? 'desc' : 'asc')); }}>
                          Avg. Score (%)
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="center" sortDirection={orderBy === 'assignments' ? order : (false as any)}>
                        <TableSortLabel active={orderBy === 'assignments'} direction={orderBy === 'assignments' ? order : 'asc'} onClick={() => { setOrderBy('assignments'); setOrder((o) => (o === 'asc' ? 'desc' : 'asc')); }}>
                          Assignments
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="center">Fees Paid</TableCell>
                      <TableCell align="center">Risk Level</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sorted.map((s, idx) => (
                      <TableRow
                        key={s.student_id}
                        hover
                        selected={selectedId === s.student_id}
                        sx={{
                          cursor: 'pointer',
                          animation: `${fadeSlideIn} 340ms ease forwards`,
                          opacity: 0,
                          animationDelay: `${Math.min(idx, 14) * 35}ms`,
                          '&.Mui-selected': { outline: (t)=> `1px solid ${t.palette.primary.main}`, transform:'translateY(-1px)', boxShadow:(t)=> `0 4px 12px -3px rgba(0,0,0,${t.palette.mode==='dark'?0.6:0.15})` },
                          '&:active': { transform:'scale(.995)' }
                        }}
                      >
                        <TableCell onClick={() => setSelectedId(s.student_id)}>{s.student_id}</TableCell>
                        <TableCell onClick={() => setSelectedId(s.student_id)} sx={{ fontWeight: 600 }}>{s.name}</TableCell>
                        <TableCell onClick={() => setSelectedId(s.student_id)} align="center">{s.attendance_percentage}</TableCell>
                        <TableCell onClick={() => setSelectedId(s.student_id)} align="center">
                          {s.avg_test_score > 0 ? (
                            s.avg_test_score
                          ) : (
                            <Box component="span" sx={{ color: 'error.main', fontWeight: 700 }}>✗</Box>
                          )}
                        </TableCell>
                        <TableCell onClick={() => setSelectedId(s.student_id)} align="center">
                          {s.assignments_submitted}/{s.total_assignments}
                        </TableCell>
                        <TableCell onClick={() => setSelectedId(s.student_id)} align="center">{s.fees_paid ? CheckIcon : CrossIcon}</TableCell>
                        <TableCell onClick={() => setSelectedId(s.student_id)} align="center">
                          <Stack spacing={0.5} alignItems="center">
                            <RiskIndicator level={s.risk_level} />
                            {predMap[s.student_id] && (
                              <ProbabilityInline probs={predMap[s.student_id].probabilities} />
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Pagination */}
            <Box sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider', bgcolor: (t)=> t.palette.mode==='dark' ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.01)' }}>
              <TablePagination
                component="div"
                count={totalCount}
                page={page - 1}
                onPageChange={(_, newPage) => setPage(newPage + 1)}
                rowsPerPage={pageSize}
                // Fixed at 20: disable changing
                onRowsPerPageChange={undefined}
                rowsPerPageOptions={[]}
                labelRowsPerPage={undefined}
                showFirstButton
                showLastButton
              />
            </Box>

            <Divider />
            {/* Actions */}
            <Box sx={{ p: 2.5, bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)') }}>
              <Paper variant="outlined" sx={{
                p: 2,
                display: 'inline-block',
                borderRadius: 2,
                borderColor: (t)=> t.palette.mode==='dark' ? '#3a3a3a' : '#CBD5E1',
                background: (t)=> t.palette.mode==='dark' ? 'linear-gradient(145deg,#2c2c2c,#272727)' : 'linear-gradient(145deg,#ffffff,#f3f4f5)',
              }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Button variant="contained" color="primary" onClick={trainModel} disabled={training} sx={{
                    fontWeight: 600,
                    position:'relative',
                    overflow:'hidden',
                    '&:before': {
                      content:'""', position:'absolute', inset:0,
                      background:'linear-gradient(120deg, rgba(255,255,255,0.15), rgba(255,255,255,0) 40%, rgba(255,255,255,0.15))',
                      transform:'translateX(-100%)',
                      animation: training ? 'none' : 'btnShine 4.5s ease-in-out infinite'
                    }
                  }}>
                    {training ? 'Training…' : 'Train Model'}
                  </Button>
                  <style>{`@keyframes btnShine{0%{transform:translateX(-100%)}60%{transform:translateX(120%)}100%{transform:translateX(120%)}}`}</style>
                  {trainInfo && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip color="default" variant="outlined" size="small"
                        label={`Model v${trainInfo.version ?? '?'} acc ${trainInfo.accuracy?.toFixed(2) ?? '-'} F1 ${trainInfo.macro_f1?.toFixed(2) ?? '-'}`}
                        sx={{ fontWeight: 500 }} />
                      <Button size="small" variant="outlined" onClick={() => setMetricsOpen(true)}>Metrics</Button>
                    </Stack>
                  )}
                </Stack>
              </Paper>
            </Box>
          </Paper>

          {/* Profile Drawer */}
          <Drawer anchor="right" open={!!selectedId} onClose={() => setSelectedId(null)}>
            <Box sx={{ width: { xs: 320, sm: 420 }, p: 2 }} role="presentation">
              {(() => {
                const s = students.find((x) => x.student_id === selectedId);
                if (!s) return null;
                const pred = predMap[s.student_id];
                return (
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <LogoImg size={32} />
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>Student #{s.student_id}</Typography>
                    </Stack>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{s.name}</Typography>
                    <Stack direction="row" spacing={1}>
                      <Chip color="primary" label={`Attendance: ${s.attendance_percentage}%`} />
                      <Chip color="primary" label={`Avg Score: ${s.avg_test_score}%`} />
                      <Chip color={s.fees_paid ? 'success' : 'error'} label={s.fees_paid ? 'Fees Paid' : 'Fees Pending'} />
                    </Stack>
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Risk</Typography>
                      <RiskIndicator level={s.risk_level} />
                    </Box>
                    <Box>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Typography variant="subtitle2">ML Prediction</Typography>
                        <Button size="small" variant="outlined" onClick={predictSelected}>Predict</Button>
                      </Stack>
                      {pred ? (
                        <ProbabilityBars probs={pred.probabilities} />
                      ) : (
                        <Typography variant="caption" color="text.secondary">No prediction yet</Typography>
                      )}
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Reasons</Typography>
                      <Stack spacing={0.5}>
                        {(s.risk_reasons || []).map((r, i) => (
                          <Typography key={i} variant="body2">• {r}</Typography>
                        ))}
                        {(!s.risk_reasons || s.risk_reasons.length === 0) && (
                          <Typography variant="body2" color="text.secondary">No specific reasons listed</Typography>
                        )}
                      </Stack>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>Last 8 weeks</Typography>
                      <Stack spacing={2}>
                        <Sparkline title="Attendance" color="#2563eb" data={s.attendance_history || []} />
                        <Sparkline title="Avg Score" color="#22c55e" data={s.score_history || []} />
                      </Stack>
                    </Box>
                    <Divider />
                    <Stack direction="row" spacing={1}>
                      <Button variant="outlined" color="secondary" onClick={() => alert('Intervention assigned (demo)')}>Assign intervention</Button>
                    </Stack>
                  </Stack>
                );
              })()}
            </Box>
          </Drawer>
        </Container>
      </Box>
    </>
  );
});

const ProbabilityBars = ({ probs }: { probs: Record<string, number> }) => {
  const order = ['High Risk', 'Medium Risk', 'Low Risk'];
  return (
    <Stack spacing={0.5}>
      {order.map((label) => {
        const p = Math.max(0, Math.min(1, probs?.[label] ?? 0));
        const color = label.includes('High') ? '#ef4444' : label.includes('Medium') ? '#f59e0b' : '#22c55e';
        return (
          <Box key={label}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>{label}</Typography>
              <Typography variant="caption">{Math.round(p * 100)}%</Typography>
            </Stack>
            <Box sx={{ height: 8, bgcolor: 'divider', borderRadius: 9999, overflow:'hidden' }}>
              <Box sx={{ width: `${p * 100}%`, height: '100%', bgcolor: color, borderRadius: 9999, transition:'width 650ms cubic-bezier(.4,0,.2,1)' }} />
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
};

const ProbabilityInline = ({ probs }: { probs: Record<string, number> }) => {
  const order = ['High Risk', 'Medium Risk', 'Low Risk'];
  const total = order.reduce((acc, k) => acc + (probs?.[k] ?? 0), 0) || 1;
  const colors = ['#ef4444', '#f59e0b', '#22c55e'];
  return (
    <Box sx={{ width: 140, height: 6, bgcolor: 'divider', borderRadius: 9999, overflow: 'hidden' }}>
      {order.map((label, idx) => {
        const p = (probs?.[label] ?? 0) / total;
        return <Box key={label} sx={{ display: 'inline-block', width: `${p * 100}%`, height: '100%', bgcolor: colors[idx] }} />;
      })}
    </Box>
  );
};

export default App;
