import React, { useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Avatar, Box, Stack, Tooltip, Typography, useTheme, Badge, IconButton } from '@mui/material';
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

  // Nav items
  const items = [
    { to: '/', label: 'Overview', caption: 'Students & metrics', icon: <DashboardIcon fontSize="small" /> },
    { to: '/notifications', label: 'Notifications', caption: 'Alerts & updates', icon: <NotificationsNoneRoundedIcon fontSize="small" />, badge: 3 },
    { to: '/settings', label: 'Settings', caption: 'Theme & tools', icon: <SettingsRoundedIcon fontSize="small" /> },
  ];

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
            <Typography className="user-id" sx={{ fontSize: '1.0625rem', fontWeight: 500, color: isDark? 'grey.300':'text.secondary', mb: 0.25 }}>PathKeepers</Typography>
            <Typography className="user-role" sx={{ fontSize: '0.75rem', fontWeight: 500, color: isDark? 'grey.500':'text.disabled' }}>Platform</Typography>
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
        <Stack direction="row" spacing={open ? 1 : 0.5} justifyContent={open ? 'flex-start' : 'center'} sx={{ px: open ? 0.5 : 0 }}>
          {['E','M','A'].map((l,i)=>(
            <Tooltip key={i} title={!open ? `User ${l}` : ''} placement="right" arrow>
              <Avatar sx={{ width: open ? 30 : 34, height: open ? 30 : 34, fontSize: 13 }}>{l}</Avatar>
            </Tooltip>
          ))}
        </Stack>
        <Link to="/" style={styleFor(true)}>
          <Box sx={{ mt: 0.5, borderRadius: '10px', textAlign: 'center', p: 0.8, bgcolor: hoverBg, '&:hover': { bgcolor: activeBg } }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{open ? 'New Task' : '+'}</Typography>
          </Box>
        </Link>
      </Stack>
    </Box>
  );
};

export default Sidebar;
