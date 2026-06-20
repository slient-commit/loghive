import { Empty } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = {
  DEBUG: '#b5b0bd',
  INFO: '#00f261',
  WARN: '#ffce00',
  ERROR: '#ff002b',
  FATAL: '#ff45a8',
};

export default function LogCharts({ stats }) {
  const data = (stats || []).map((s) => ({
    level: s._id,
    count: s.count,
  }));

  if (!data.length) {
    return (
      <div style={{ background: '#fff', border: '1px solid #e6e6e9', borderRadius: 6, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#3e3b45', marginBottom: 12 }}>Log Distribution</div>
        <Empty description="No log data" style={{ padding: 24 }} />
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e6e6e9', borderRadius: 6, padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#3e3b45', marginBottom: 12 }}>Log Distribution</div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 0, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f2" />
          <XAxis dataKey="level" tick={{ fontSize: 11, fill: '#80748c' }} axisLine={{ stroke: '#e6e6e9' }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#80748c' }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 4, border: '1px solid #e6e6e9', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.level} fill={COLORS[entry.level] || '#b5b0bd'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
