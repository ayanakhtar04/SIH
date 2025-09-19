import React from 'react';
import styles from './KPICard.module.css';

const KPICard = ({ title, value, subtitle }) => (
  <div className={styles.kpiCard}>
    <span className={styles.kpiTitle}>{title}</span>
    <span className={styles.kpiValue}>{value}</span>
    {subtitle && <span className={styles.kpiSubtitle}>{subtitle}</span>}
  </div>
);

export default KPICard;