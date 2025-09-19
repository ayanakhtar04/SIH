import React, { useEffect, useMemo, useState } from 'react';
import styles from './OverviewPage.module.css';
import KPICard from '../components/KPICard';
import HighRiskList from '../components/HighRiskList';
import MainChart from '../components/MainChart';
import { API } from '../api';

// HighRiskList component imported above

const OverviewPage = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch a large page to cover most students; backend caps at 200 per page
        const url = `${API.students}?page=1&page_size=200&sort_by=risk_level&sort_dir=desc`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = await res.json();
        setStudents(json.data || []);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const { highCount, medCount, lowCount, highList } = useMemo(() => {
    const high = students.filter(s => s.risk_level === 'High Risk');
    const med = students.filter(s => s.risk_level === 'Medium Risk');
    const low = students.filter(s => s.risk_level === 'Low Risk');
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
