import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Typography, Tabs, Form, Input, Select, Button, Switch, Skeleton, message } from 'antd';
import { KeyOutlined, PlusOutlined } from '@ant-design/icons';
import ApiKeyTable from '../components/ApiKeyTable';
import ApiKeyModal from '../components/ApiKeyModal';
import { useApp, useUpdateApp, useApiKeys, useCreateApiKey, useRevokeApiKey } from '../hooks/useApps';
import { useAuth } from '../auth/AuthContext';

const { Text } = Typography;

export default function AppSettings() {
  const { id: uuid } = useParams();
  const { user } = useAuth();
  const { data: app, isLoading } = useApp(uuid);
  const { data: keys, isLoading: keysLoading } = useApiKeys(uuid);
  const updateApp = useUpdateApp();
  const createApiKey = useCreateApiKey();
  const revokeApiKey = useRevokeApiKey();

  const [newKey, setNewKey] = useState(null);
  const [keyName, setKeyName] = useState('');

  const canManage = ['org_admin', 'member'].includes(user?.role);

  const handleSave = async (values) => {
    try {
      await updateApp.mutateAsync({ id: uuid, data: values });
      message.success('App updated');
    } catch (err) {
      message.error(err.response?.data?.error || 'Update failed');
    }
  };

  const handleGenerateKey = async () => {
    try {
      const result = await createApiKey.mutateAsync({ appId: uuid, name: keyName || 'Default Key' });
      setNewKey(result.key);
      setKeyName('');
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to generate key');
    }
  };

  const handleRevokeKey = async (keyId) => {
    try {
      await revokeApiKey.mutateAsync({ appId: uuid, keyId });
      message.success('API key revoked');
    } catch (err) {
      message.error('Failed to revoke key');
    }
  };

  if (isLoading) return <Skeleton active />;

  const items = [
    {
      key: 'general',
      label: 'General',
      children: (
        <Form
          layout="vertical"
          initialValues={app}
          onFinish={handleSave}
          disabled={!canManage}
          style={{ maxWidth: 500 }}
        >
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="environment" label="Environment">
            <Select
              options={[
                { value: 'production', label: 'Production' },
                { value: 'staging', label: 'Staging' },
                { value: 'development', label: 'Development' },
              ]}
            />
          </Form.Item>
          <Form.Item name="status" label="Status" valuePropName="checked">
            <Switch
              checkedChildren="Active"
              unCheckedChildren="Archived"
              defaultChecked={app?.status === 'active'}
              onChange={(checked) => {
                handleSave({ ...app, status: checked ? 'active' : 'archived' });
              }}
            />
          </Form.Item>
          {canManage && (
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={updateApp.isPending}>
                Save Changes
              </Button>
            </Form.Item>
          )}
        </Form>
      ),
    },
    {
      key: 'keys',
      label: (
        <span>
          <KeyOutlined /> API Keys
        </span>
      ),
      children: (
        <div>
          {canManage && (
            <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
              <Input
                placeholder="Key name (e.g., Production Key)"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                style={{ maxWidth: 300 }}
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleGenerateKey}
                loading={createApiKey.isPending}
              >
                Generate Key
              </Button>
            </div>
          )}
          <ApiKeyTable
            keys={keys || []}
            onRevoke={handleRevokeKey}
            loading={keysLoading}
            canManage={canManage}
          />
          <ApiKeyModal
            open={!!newKey}
            apiKey={newKey}
            onClose={() => setNewKey(null)}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <Text strong style={{ display: 'block', fontSize: 20, color: '#3e3b45', marginBottom: 12 }}>{app?.name} — Settings</Text>
      <Tabs items={items} />
    </div>
  );
}
