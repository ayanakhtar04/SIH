import React from 'react';
import styles from './HighRiskList.module.css';

const HighRiskList = ({ items }) => (
  <div className={styles.panel}>
    <h3 className={styles.title}>High-Risk Students</h3>
    {items && items.length > 0 ? (
      <ul className={styles.list}>
        {items.map(student => (
          <li key={student.student_id} className={styles.listItem}>
            <span>{student.name}</span>
            <span className={styles.riskReason}>{student.risk_reasons.join(', ')}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className={styles.emptyMessage}>No high-risk students to display.</p>
    )}
  </div>
);

export default HighRiskList;