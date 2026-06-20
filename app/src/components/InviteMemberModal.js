import { Modal, Form, Input, Select, message } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import { useInviteMember } from '../hooks/useOrganization';

export default function InviteMemberModal({ open, onClose }) {
  const [form] = Form.useForm();
  const inviteMember = useInviteMember();

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      await inviteMember.mutateAsync(values);
      message.success('Invitation sent! They will receive an email to set their password.');
      form.resetFields();
      onClose();
    } catch (err) {
      if (err.response?.data?.error) {
        message.error(err.response.data.error);
      }
    }
  };

  return (
    <Modal
      title="Invite Member"
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={inviteMember.isPending}
      okText="Send Invitation"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Please enter email' },
            { type: 'email', message: 'Invalid email' },
          ]}
        >
          <Input prefix={<MailOutlined />} placeholder="member@company.com" />
        </Form.Item>

        <Form.Item
          name="role"
          label="Role"
          rules={[{ required: true, message: 'Please select a role' }]}
          initialValue="viewer"
        >
          <Select
            options={[
              { value: 'member', label: 'Member — Can create and manage apps' },
              { value: 'viewer', label: 'Viewer — Read-only access' },
            ]}
          />
        </Form.Item>

        <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
          An email will be sent with a link to set their password and access the platform. The invitation expires in 48 hours.
        </p>
      </Form>
    </Modal>
  );
}
