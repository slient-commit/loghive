import { useState } from 'react';
import { Typography, Descriptions, Skeleton, Switch, message, Divider } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import RoleBadge from '../components/RoleBadge';
import { useAuth } from '../auth/AuthContext';
import { updateSettings } from '../api/auth';

const { Title, Text } = Typography;

export default function UserProfile() {
  const { user, organization, isLoading } = useAuth();
  const [fatalEmails, setFatalEmails] = useState(user?.receive_fatal_emails ?? false);
  const [saving, setSaving] = useState(false);

  const handleToggle = async (checked) => {
    setSaving(true);
    try {
      await updateSettings({ receive_fatal_emails: checked });
      setFatalEmails(checked);
      message.success(checked ? 'You will receive FATAL error alerts' : 'FATAL error alerts disabled');
    } catch (err) {
      message.error('Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <Skeleton active />;

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>Profile</Title>

      <Descriptions bordered column={1} style={{ maxWidth: 500 }}>
        <Descriptions.Item label="Email">{user?.email}</Descriptions.Item>
        <Descriptions.Item label="Role">
          <RoleBadge role={user?.role} />
        </Descriptions.Item>
        <Descriptions.Item label="Organization">{organization?.name}</Descriptions.Item>
      </Descriptions>

      <Divider />

      <Title level={5}>
        <MailOutlined style={{ marginRight: 8 }} />
        Notification Settings
      </Title>

      <div style={{ maxWidth: 500, marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text strong>FATAL Error Email Alerts</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Receive an email when a FATAL error is first detected (once per unique error per day)
          </Text>
        </div>
        <Switch
          checked={fatalEmails}
          onChange={handleToggle}
          loading={saving}
          checkedChildren="On"
          unCheckedChildren="Off"
        />
      </div>
    </div>
  );
}
