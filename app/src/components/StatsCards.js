import { Row, Col, Statistic } from 'antd';
import { formatDateShort } from '../utils/formatters';

export default function StatsCards({ stats }) {
  const getCount = (level) => {
    const entry = (stats || []).find((s) => s._id === level);
    return entry ? entry.count : 0;
  };

  const total = (stats || []).reduce((sum, s) => sum + s.count, 0);
  const latestAll = (stats || []).reduce((latest, s) => {
    if (!latest || (s.latest && new Date(s.latest) > new Date(latest))) return s.latest;
    return latest;
  }, null);

  const items = [
    { title: 'Total', value: total.toLocaleString(), color: '#6c47ff' },
    { title: 'Errors', value: (getCount('ERROR') + getCount('FATAL')).toLocaleString(), color: '#e5254b' },
    { title: 'Warnings', value: getCount('WARN').toLocaleString(), color: '#f5a623' },
    { title: 'Latest', value: latestAll ? formatDateShort(latestAll) : '—', color: '#8c869a', fontSize: 16 },
  ];

  return (
    <Row gutter={[16, 16]}>
      {items.map((item) => (
        <Col xs={12} lg={6} key={item.title}>
          <div style={{
            background: '#fff', border: '1px solid #e4e2e8', borderRadius: 8,
            padding: '14px 20px', borderTop: `3px solid ${item.color}`,
            boxShadow: '0 1px 2px rgba(43,40,51,0.04)',
          }}>
            <Statistic
              title={item.title}
              value={item.value}
              valueStyle={{ color: '#2b2833', fontSize: item.fontSize || 28 }}
            />
          </div>
        </Col>
      ))}
    </Row>
  );
}
