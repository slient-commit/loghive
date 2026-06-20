import { useState } from 'react';
import { Typography, Button, Row, Col, Modal, Form, Input, Select, Empty, Skeleton, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import AppCard from '../components/AppCard';
import { useApps, useCreateApp } from '../hooks/useApps';
import { useAuth } from '../auth/AuthContext';

const { Text } = Typography;

export default function Apps() {
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const { data: apps, isLoading } = useApps();
  const createApp = useCreateApp();
  const { user } = useAuth();

  const canCreate = ['org_admin', 'member'].includes(user?.role);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await createApp.mutateAsync(values);
      message.success('Application created');
      form.resetFields();
      setModalOpen(false);
    } catch (err) {
      if (err.response?.data?.error) {
        message.error(err.response.data.error);
      }
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text strong style={{ fontSize: 20, color: '#3e3b45' }}>Applications</Text>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Create App
          </Button>
        )}
      </div>

      {isLoading ? (
        <Row gutter={[12, 12]}>
          {[1, 2, 3].map((i) => (
            <Col xs={24} sm={12} lg={8} key={i}>
              <Skeleton active />
            </Col>
          ))}
        </Row>
      ) : (apps || []).length === 0 ? (
        <Empty description="No applications yet" style={{ marginTop: 48 }}>
          {canCreate && (
            <Button type="primary" onClick={() => setModalOpen(true)}>
              Create Your First App
            </Button>
          )}
        </Empty>
      ) : (
        <Row gutter={[12, 12]}>
          {apps.map((app) => (
            <Col xs={24} sm={12} lg={8} key={app.uuid}>
              <AppCard app={app} />
            </Col>
          ))}
        </Row>
      )}

      <Modal
        title="Create Application"
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => setModalOpen(false)}
        confirmLoading={createApp.isPending}
        okText="Create"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="name"
            label="App Name"
            rules={[{ required: true, message: 'Please enter app name' }]}
          >
            <Input placeholder="My Application" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Brief description" />
          </Form.Item>

          <Form.Item name="environment" label="Environment" initialValue="production">
            <Select
              options={[
                { value: 'production', label: 'Production' },
                { value: 'staging', label: 'Staging' },
                { value: 'development', label: 'Development' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
