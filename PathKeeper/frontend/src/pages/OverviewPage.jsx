import React, { useEffect, useMemo, useState, useCallback } from 'react';
import styles from './OverviewPage.module.css';
import KPICard from '../components/KPICard';
import HighRiskList from '../components/HighRiskList';
import MainChart from '../components/MainChart';
import { API } from '../api';
import { mapBackendTier } from '../risk/riskUtil';
import { useAuth } from '../auth/AuthContext';

// HighRiskList component imported above

const OverviewPage = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { session } = useAuth();
  const fetchAll = useCallback(async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch a large page; for mentors this returns assigned students, for admins it returns all.
        const url = `${API.students}?page=1&pageSize=200`;
        const headers = session?.token ? { Authorization: `Bearer ${session.token}` } : undefined;
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = await res.json();
  setStudents(json.data || json.students || []);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
  }, [session?.token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  // Refresh when students update (claimed/edited/assigned)
  useEffect(() => {
    const handler = () => fetchAll();
    window.addEventListener('pk:students-updated', handler);
    return () => window.removeEventListener('pk:students-updated', handler);
  }, [fetchAll]);

  const { highCount, medCount, lowCount, highList } = useMemo(() => {
  const high = students.filter(s => {
    const tier = s.riskTier ? mapBackendTier(s.riskTier) : (s.risk_level==='High Risk'?'High': undefined);
    return tier === 'High';
  });
  const med = students.filter(s => {
    const tier = s.riskTier ? mapBackendTier(s.riskTier) : (s.risk_level==='Medium Risk'?'Medium': undefined);
    return tier === 'Medium';
  });
  const low = students.filter(s => {
    const tier = s.riskTier ? mapBackendTier(s.riskTier) : (s.risk_level==='Low Risk'?'Low': undefined);
    return tier === 'Low';
  });
    return {
      highCount: high.length,
      medCount: med.length,
      lowCount: low.length,
      highList: high.slice(0, 8),
    };
  }, [students]);

  // Build a tiny synthetic trend using aggregated counts (placeholder for now)
  const chartData = useMemo(() => {
    const total = students.length || 1;
    const riskIndex = Math.round(((highCount * 3 + medCount * 2 + lowCount * 1) / (total * 3)) * 100);
    const base = [riskIndex - 6, riskIndex - 3, riskIndex - 1, riskIndex - 4, riskIndex - 2, riskIndex - 1, riskIndex, riskIndex + 2].map(v => Math.max(0, Math.min(100, v)));
    return ['W-7','W-6','W-5','W-4','W-3','W-2','W-1','W0'].map((label, i) => ({ label, value: base[i] }));
  }, [highCount, medCount, lowCount, students.length]);

  return (
    <div className={styles.pageRoot}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1>Dashboard</h1>
          <div className={styles.headerActions}>
            <input className={styles.searchInput} placeholder="Search students…" />
            <button className={styles.alertButton}>Critical Alert</button>
            <div className={styles.profile} />
          </div>
        </header>

        <div className={styles.kpiGrid}>
          <KPICard title="High Risk Students" value={loading ? '…' : highCount} />
          <KPICard title="Medium Risk Students" value={loading ? '…' : medCount} />
          <KPICard title="Low Risk Students" value={loading ? '…' : lowCount} />
          <KPICard title="Highest Risk Factor" value="Attendance" />
        </div>

        <div className={styles.mainGrid}>
          <div className={styles.panel}>
            <h3 style={{ marginTop: 0 }}>Dropout Risk Trends Over Time</h3>
            <MainChart data={chartData} />
          </div>
          <HighRiskList items={highList} />
        </div>
        {error && <div style={{ color: 'salmon', marginTop: 12 }}>{error}</div>}
      </div>
    </div>
  );
};

export default OverviewPage;
