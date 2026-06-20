import { Tag, Typography } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { ENV_COLORS, STATUS_COLORS } from '../utils/constants';
import { formatRelative } from '../utils/formatters';

const { Text, Paragraph } = Typography;

export default function AppCard({ app }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/logs/${app.uuid}`)}
      style={{
        background: '#fff',
        border: '1px solid #e4e2e8',
        borderRadius: 8,
        padding: 20,
        cursor: 'pointer',
        height: '100%',
        transition: 'border-color 150ms, box-shadow 150ms',
        boxShadow: '0 1px 2px rgba(43,40,51,0.04)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#d0cdd8';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(43,40,51,0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#e4e2e8';
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(43,40,51,0.04)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Text strong style={{ fontSize: 15, flex: 1, color: '#2b2833' }}>{app.name}</Text>
        <SettingOutlined
          style={{ fontSize: 14, color: '#b5b0bd', cursor: 'pointer', transition: 'color 150ms' }}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/apps/${app.uuid}/settings`);
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#6c47ff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#b5b0bd'; }}
        />
        <Tag color={STATUS_COLORS[app.status]} style={{ margin: 0 }}>{app.status}</Tag>
      </div>

      {app.description && (
        <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 10, fontSize: 13, color: '#8c869a', lineHeight: 1.6 }}>
          {app.description}
        </Paragraph>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Tag color={ENV_COLORS[app.environment] || 'default'}>{app.environment}</Tag>
        <Text style={{ fontSize: 12, color: '#b5b0bd' }}>
          {formatRelative(app.created_at || app.createdAt)}
        </Text>
      </div>
    </div>
  );
}
