import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Avatar, Box, Stack, Tooltip, Typography, useTheme, Badge, IconButton, Chip, alpha, Button } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../auth/AuthContext';
// Import API base to build health endpoint
// Using optional import pattern in case path changes later
import { API_BASE } from '../api';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';

type SidebarProps = { open?: boolean; onToggle?: (open: boolean)=>void };

const Sidebar: React.FC<SidebarProps> = ({ open: controlledOpen, onToggle }) => {
  const theme = useTheme();
  const location = useLocation();
  const [uncontrolled, setUncontrolled] = useState(true);
  const isControlled = typeof controlledOpen === 'boolean';
  const open = isControlled ? (controlledOpen as boolean) : uncontrolled; // fallback internal
  const handleToggle = useCallback(()=> {
    if (isControlled) {
      onToggle && onToggle(!open);
    } else {
      setUncontrolled(o=>!o);
    }
  }, [isControlled, onToggle, open]);

  const isDark = theme.palette.mode === 'dark';
  const bgPrimary = theme.palette.background.paper;
  const hoverBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const activeBg = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)';
  const accent = theme.palette.primary.main;

  const styleFor = (active: boolean): React.CSSProperties => ({
    textDecoration: 'none',
    color: 'inherit',
    display: 'block',
    borderRadius: 8,
    outline: 'none',
  });

  const auth = useAuth();
  const currentRole = (auth.session as any)?.role || ((auth.session as any)?.kind === 'student' ? 'student' : undefined);
  const userInitial = currentRole ? currentRole.charAt(0).toUpperCase() : 'U';

  // Nav items (typed with optional badge)
  interface NavItem { to: string; label: string; caption: string; icon: React.ReactNode; badge?: number; }
  const role = currentRole;
  const baseItems: NavItem[] = [
    { to: '/', label: 'Overview', caption: 'Students & metrics', icon: <DashboardIcon fontSize="small" /> },
    { to: '/notifications', label: 'Notifications', caption: 'Alerts & updates', icon: <NotificationsNoneRoundedIcon fontSize="small" />, badge: 3 },
    { to: '/import', label: 'Import', caption: 'Bulk students', icon: <SettingsRoundedIcon fontSize="small" /> },
    { to: '/settings', label: 'Settings', caption: 'Theme & tools', icon: <SettingsRoundedIcon fontSize="small" /> },
  ];
  const mentorLink: NavItem[] = role && ['mentor','teacher','counselor','admin'].includes(role.toLowerCase())
    ? [{ to: '/mentor', label: 'Mentor Dash', caption: 'Advise students', icon: <DashboardIcon fontSize="small" /> }]
    : [];
  const items: NavItem[] = mentorLink.concat(baseItems);

  // Health status state
  const [health, setHealth] = useState<{state: 'unknown'|'online'|'offline'; latency?: number; last?: Date}>({ state: 'unknown' });
  const timerRef = useRef<number | null>(null);

  const performHealthCheck = useCallback(async () => {
    const start = performance.now();
    try {
      const res = await fetch(`${API_BASE.replace(/\/$/, '')}/health`, { method: 'GET' });
      const latency = performance.now() - start;
      if (!res.ok) throw new Error('Bad status');
      await res.json().catch(()=>({}));
      setHealth({ state: 'online', latency, last: new Date() });
    } catch {
      const latency = performance.now() - start;
      setHealth(h => ({ state: 'offline', latency, last: new Date() }));
    }
  }, []);

  useEffect(() => {
    // Immediate check then interval
    performHealthCheck();
    timerRef.current = window.setInterval(performHealthCheck, 60000); // 60s
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [performHealthCheck]);

  const healthColor = health.state === 'online' ? 'success' : health.state === 'offline' ? 'error' : 'default';
  const healthLabel = health.state === 'online' ? 'Online' : health.state === 'offline' ? 'Offline' : 'Checking';
  const healthTooltip = () => {
    const base = `API: ${healthLabel}`;
    if (health.last) return `${base}\nLast: ${health.last.toLocaleTimeString()}${health.latency ? ` (${Math.round(health.latency)}ms)` : ''}`;
    return base;
  };

  // moved auth/currentRole earlier to avoid TDZ

  return (
    <Box component="aside" sx={{
      position: 'fixed', top: 16, left: 16,
      height: 'calc(100vh - 32px)',
      width: open ? '16.875rem' : '5.0rem', // widened collapsed width to avoid logo clipping
      transition: 'width 300ms ease-out',
      borderRadius: '12px',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      background: bgPrimary,
      boxShadow: isDark ? '0 3px 5px #0006, 0 6px 22px -6px #000a' : '0 3px 5px #1233, 0 5px 17px #0003',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
      zIndex: (t)=> t.zIndex.appBar + 1,
      p: '8px'
    }}>
      {/* Header with internal toggle then figure (replicates provided structure) */}
      <Box component="header" sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, alignItems: 'stretch', mb: 1 }}>
  <Box className="sidebar__toggle-container" sx={{ height: '2.25rem', display: 'flex', justifyContent: open ? 'flex-end' : 'center', alignItems: 'center' }}>
          <IconButton onClick={handleToggle} size="small" sx={{
            width: '2.25rem', height: '2.25rem', borderRadius: '10px',
            transition: 'outline-color 233ms, background 233ms',
            outline: '2px solid transparent', outlineOffset: '-2px',
            '&:hover': { outline: `2px solid ${accent}` },
          }} aria-label={open ? 'Collapse navigation' : 'Expand navigation'}>
            {open ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.707 6.707a1 1 0 0 0-1.414-1.414L12 10.586 6.707 5.293a1 1 0 0 0-1.414 1.414L10.586 12l-5.293 5.293a1 1 0 1 0 1.414 1.414L12 13.414l5.293 5.293a1 1 0 0 0 1.414-1.414L13.414 12z" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 5a1 1 0 1 0 0 2h18a1 1 0 1 0 0-2zM2 12a1 1 0 0 1 1-1h18a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1M2 18a1 1 0 0 1 1-1h18a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1" />
              </svg>
            )}
          </IconButton>
        </Box>
        <Box component="figure" sx={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5,
          mx: 'auto', width: '100%', transition: 'opacity 300ms',
        }}>
          <Box component="img" src="/pathkeepers-logo.png" onError={(e: any)=>{ e.currentTarget.src='/vite.svg' }} alt="PathKeepers" sx={{
            width: open ? '48%' : '3.2rem', aspectRatio: '1 / 1', minWidth: '3.0rem', objectFit: 'cover', display: 'block',
            mx: 'auto', transition: 'width 160ms ease, transform 300ms',
            transform: open ? 'translateY(0)' : 'translateY(0)'
          }} />
          <Box component="figcaption" sx={{ textAlign: 'center', opacity: open ? 1 : 0, transition: 'opacity 300ms 200ms' }}>
              <Stack spacing={0.3} alignItems="center">
                <Avatar sx={{ width: 38, height: 38, bgcolor: accent, fontSize: 18 }}>
                  {userInitial}
                </Avatar>
                <Typography className="user-id" sx={{ fontSize: '0.85rem', fontWeight: 600, maxWidth: '100%', wordBreak: 'break-word', color: isDark? 'grey.200':'text.primary' }}>
                  {open ? (auth.session ? (((auth.session as any).email) || 'Signed In') : 'Guest') : ''}
                </Typography>
                <Typography className="user-role" sx={{ fontSize: '0.65rem', fontWeight: 500, letterSpacing: 0.5, color: isDark? 'grey.500':'text.disabled', textTransform:'uppercase' }}>
                  {open ? (currentRole || 'unknown') : ''}
                </Typography>
              </Stack>
            </Box>
        </Box>
      </Box>

      {/* Nav group (primary) */}
      <Stack spacing={0.5} sx={{ px: 0.5, flex: 1, overflowY: 'auto' }}>
        <Typography variant="overline" sx={{
          opacity: open ? 0.66 : 0,
          pl: open ? 1 : 0,
          height: 18,
          display: 'flex', alignItems: 'flex-end',
          letterSpacing: '0.35px', textTransform: 'uppercase', fontSize: '0.65rem',
          transition: 'opacity 300ms'
        }}>General</Typography>

        {items.map(item => {
          const active = location.pathname === item.to;
          const node = (
            <Box sx={{
              position: 'relative',
              height: '2.25rem',
              px: open ? 1 : 0, // remove horizontal padding in collapsed for centering
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', gap: 1,
              bgcolor: active ? activeBg : 'transparent',
              transition: 'background 220ms, transform 220ms',
              justifyContent: open ? 'flex-start' : 'center',
              '&:hover': { bgcolor: hoverBg, transform: open ? 'translateX(2px)' : 'none' },
              '&:focus-visible': { outline: `2px solid ${accent}`, outlineOffset: '-2px', bgcolor: active ? activeBg : hoverBg },
            }}>
              {item.badge ? (
                <Badge badgeContent={item.badge} color="error" sx={{ '& .MuiBadge-badge': { fontSize: 9 } }}>
                  {item.icon}
                </Badge>
              ) : item.icon}
              {open && (
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.1 }}>{item.label}</Typography>
                  <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', lineHeight: 1.1 }}>{item.caption}</Typography>
                </Box>
              )}
            </Box>
          );
          return (
            <Tooltip key={item.to} title={!open ? item.label : ''} placement="right" arrow>
              <Link to={item.to} style={styleFor(active)}>{node}</Link>
            </Tooltip>
          );
        })}
      </Stack>

      {/* Footer secondary group */}
      <Stack spacing={0.75} sx={{ p: 0.5, pt: 0, pb: 1 }}>
        <Typography variant="overline" sx={{
          opacity: open ? 0.66 : 0,
          pl: open ? 1 : 0,
          height: 18,
          letterSpacing: '0.35px', textTransform: 'uppercase', fontSize: '0.65rem',
          transition: 'opacity 300ms'
        }}>Secondary</Typography>

        {/* Health badge */}
        <Box sx={{ px: open ? 0.5 : 0, display: 'flex', justifyContent: open ? 'flex-start' : 'center' }}>
          {open ? (
            <Tooltip title={healthTooltip()} placement="right" arrow>
              <Chip
                size="small"
                label={`API: ${healthLabel}`}
                color={healthColor === 'default' ? undefined : healthColor as any}
                variant={health.state === 'online' ? 'filled' : 'outlined'}
                sx={{
                  fontWeight: 500,
                  letterSpacing: 0.3,
                  bgcolor: (t) => health.state === 'online' ? alpha(t.palette.success.main, 0.12) : undefined,
                }}
              />
            </Tooltip>
          ) : (
            <Tooltip title={healthTooltip()} placement="right" arrow>
              <Box sx={{ width: 14, height: 14, borderRadius: '50%',
                bgcolor: (t)=> health.state === 'online' ? t.palette.success.main : health.state === 'offline' ? t.palette.error.main : t.palette.action.disabled,
                boxShadow: (t)=> health.state === 'online' ? `0 0 0 4px ${alpha(t.palette.success.main,0.25)}` : 'none',
                transition: 'background 300ms, box-shadow 300ms' }} />
            </Tooltip>
          )}
        </Box>
        <Stack direction="column" spacing={1} sx={{ px: open ? 0.5 : 0, width:'100%' }}>
          <Tooltip title={open ? 'Sign out' : 'Logout'} placement="right" arrow>
            <Button
              onClick={() => { auth.logout(); }}
              size="small"
              fullWidth
              variant="outlined"
              startIcon={open ? <LogoutIcon fontSize="small" /> : undefined}
              sx={{
                justifyContent: open ? 'flex-start' : 'center',
                minHeight: 36,
                fontWeight: 600,
                textTransform: 'none',
                borderRadius: 2,
                px: open ? 1.4 : 0,
              }}
            >
              {open ? 'Logout' : <LogoutIcon fontSize="small" />}
            </Button>
          </Tooltip>
        </Stack>
      </Stack>
    </Box>
  );
};

export default Sidebar;
