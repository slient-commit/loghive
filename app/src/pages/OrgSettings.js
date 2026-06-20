import { Typography, Form, Input, Button, Skeleton, Descriptions, message } from 'antd';
import { useOrganization, useUpdateOrganization } from '../hooks/useOrganization';
import { useAuth } from '../auth/AuthContext';

const { Title } = Typography;

export default function OrgSettings() {
  const { user } = useAuth();
  const { data: org, isLoading } = useOrganization();
  const updateOrg = useUpdateOrganization();

  const isAdmin = user?.role === 'org_admin';

  const handleSave = async (values) => {
    try {
      await updateOrg.mutateAsync(values);
      message.success('Organization updated');
    } catch (err) {
      message.error(err.response?.data?.error || 'Update failed');
    }
  };

  if (isLoading) return <Skeleton active />;

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>Organization Settings</Title>

      {isAdmin ? (
        <Form
          layout="vertical"
          initialValues={org}
          onFinish={handleSave}
          style={{ maxWidth: 500 }}
        >
          <Form.Item name="name" label="Organization Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="slug" label="Slug" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={updateOrg.isPending}>
              Save Changes
            </Button>
          </Form.Item>
        </Form>
      ) : (
        <Descriptions bordered column={1}>
          <Descriptions.Item label="Name">{org?.name}</Descriptions.Item>
          <Descriptions.Item label="Slug">{org?.slug}</Descriptions.Item>
          <Descriptions.Item label="Status">{org?.status}</Descriptions.Item>
        </Descriptions>
      )}
    </div>
  );
}
