import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import styles from './MainChart.module.css';

const MainChart = ({ data }) => {
  return (
    <div className={styles.chartContainer}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis dataKey="label" stroke="var(--text-secondary)" />
          <YAxis stroke="var(--text-secondary)" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--surface-color)',
              borderColor: 'var(--border-color)',
            }}
          />
          <Legend wrapperStyle={{ color: 'var(--text-primary)' }} />
          <Line type="monotone" dataKey="value" stroke="var(--accent-color)" strokeWidth={2} activeDot={{ r: 8 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MainChart;