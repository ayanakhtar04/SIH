import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Chip, Tooltip } from '@mui/material';
import { API_BASE } from '../api';

type HealthState = {
  status: 'healthy' | 'degraded' | 'down' | 'loading';
  latencyMs?: number;
  lastChecked?: number;
  error?: string;
};

interface ApiStatusProps {
  intervalMs?: number; // polling interval
  showLatency?: boolean;
}

// Heuristic thresholds
const DEGRADED_LATENCY = 1000; // ms

const ApiStatus: React.FC<ApiStatusProps> = ({ intervalMs = 15000, showLatency = false }) => {
  const [health, setHealth] = useState<HealthState>({ status: 'loading' });
  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchHealth = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const started = performance.now();
    try {
      setHealth(h => (h.status === 'loading' ? h : { ...h, status: h.status, error: undefined }));
      const res = await fetch(`${API_BASE.replace(/\/$/, '')}/health`, { signal: controller.signal });
      const latency = performance.now() - started;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let json: any = null;
      try { json = await res.json(); } catch { /* ignore */ }
      const hasExpected = json && (json.ok === true || json.status === 'ok');
      const degraded = latency >= DEGRADED_LATENCY || !hasExpected;
      setHealth({
        status: degraded ? 'degraded' : 'healthy',
        latencyMs: Math.round(latency),
        lastChecked: Date.now(),
        error: undefined
      });
    } catch (e: any) {
      const latency = performance.now() - started;
      setHealth({ status: 'down', latencyMs: Math.round(latency), lastChecked: Date.now(), error: e?.message || 'Error' });
    }
  }, []);

  // Polling logic with page visibility pause
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      if (document.hidden) { schedule(); return; }
      fetchHealth().finally(() => schedule());
    };
    const schedule = () => {
      timerRef.current = window.setTimeout(tick, intervalMs);
    };
    fetchHealth().then(() => schedule());
    const onVisibility = () => {
      if (!document.hidden) {
        // immediate refresh when returning
        fetchHealth();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchHealth, intervalMs]);

  const handleManual = () => fetchHealth();

  const { status, latencyMs, lastChecked, error } = health;
  const color: any = status === 'healthy' ? 'success' : status === 'degraded' ? 'warning' : status === 'down' ? 'error' : 'default';
  const label = (() => {
    switch (status) {
      case 'healthy': return 'API: Healthy';
      case 'degraded': return 'API: Degraded';
      case 'down': return 'API: Down';
      default: return 'API: …';
    }
  })();
  const detailLines: string[] = [];
  if (latencyMs != null) detailLines.push(`Latency: ${latencyMs}ms`);
  if (lastChecked) detailLines.push(`Checked: ${new Date(lastChecked).toLocaleTimeString()}`);
  if (error && status === 'down') detailLines.push(`Error: ${error}`);
  detailLines.push('Click to refresh');
  const tooltip = detailLines.join('\n');

  return (
    <Tooltip title={<span style={{ whiteSpace:'pre-line' }}>{tooltip}</span>} arrow>
      <Chip
        size="small"
        clickable
        onClick={handleManual}
        color={color}
        variant={status === 'healthy' ? 'filled' : 'outlined'}
        label={showLatency && latencyMs != null ? `${label} (${latencyMs}ms)` : label}
        sx={{ fontWeight:600 }}
      />
    </Tooltip>
  );
};

export default ApiStatus;
