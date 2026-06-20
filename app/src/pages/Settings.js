import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Typography, Tabs, Form, Input, Button, Descriptions, Switch, Divider, Skeleton, message, Radio, InputNumber } from 'antd';
import { BankOutlined, TeamOutlined, UserOutlined, MailOutlined, PlusOutlined, SendOutlined } from '@ant-design/icons';
import RoleBadge from '../components/RoleBadge';
import MemberTable from '../components/MemberTable';
import InviteMemberModal from '../components/InviteMemberModal';
import { useAuth } from '../auth/AuthContext';
import { useOrganization, useUpdateOrganization, useMembers } from '../hooks/useOrganization';
import { updateSettings } from '../api/auth';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getEmailSettings, updateEmailSettings, testEmailSettings } from '../api/emailSettings';

const { Title, Text } = Typography;

function OrganizationTab() {
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

  if (!isAdmin) {
    return (
      <Descriptions bordered column={1}>
        <Descriptions.Item label="Name">{org?.name}</Descriptions.Item>
        <Descriptions.Item label="Slug">{org?.slug}</Descriptions.Item>
        <Descriptions.Item label="Status">{org?.status}</Descriptions.Item>
      </Descriptions>
    );
  }

  return (
    <Form layout="vertical" initialValues={org} onFinish={handleSave} style={{ maxWidth: 500 }}>
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
  );
}

function MembersTab() {
  const [modalOpen, setModalOpen] = useState(false);
  const { data: members, isLoading } = useMembers();
  const { user } = useAuth();
  const isAdmin = user?.role === 'org_admin';

  return (
    <div>
      {isAdmin && (
        <div style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Invite Member
          </Button>
        </div>
      )}
      <MemberTable members={members || []} loading={isLoading} />
      <InviteMemberModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

function ProfileTab() {
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
      <Descriptions bordered column={1} style={{ maxWidth: 500 }}>
        <Descriptions.Item label="Email">{user?.email}</Descriptions.Item>
        <Descriptions.Item label="Role"><RoleBadge role={user?.role} /></Descriptions.Item>
        <Descriptions.Item label="Organization">{organization?.name}</Descriptions.Item>
      </Descriptions>

      <Divider />

      <Title level={5}>
        <MailOutlined style={{ marginRight: 8 }} />
        Notification Settings
      </Title>

      <div style={{ maxWidth: 500, marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text strong>FATAL Error Email Alerts</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Receive an email when a FATAL error is first detected (once per unique error per day)
          </Text>
        </div>
        <Switch checked={fatalEmails} onChange={handleToggle} loading={saving} checkedChildren="On" unCheckedChildren="Off" />
      </div>
    </div>
  );
}

function EmailTab() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'org_admin';
  const [form] = Form.useForm();
  const [provider, setProvider] = useState('resend');
  const [testing, setTesting] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['email-settings'],
    queryFn: getEmailSettings,
  });

  // Populate form once data arrives from server
  useEffect(() => {
    if (!settings) return;
    const p = settings.provider || 'resend';
    setProvider(p);
    form.setFieldsValue({
      provider: p,
      resend_from_email: settings.resend_from_email || '',
      smtp_host: settings.smtp_host || '',
      smtp_port: settings.smtp_port || 587,
      smtp_user: settings.smtp_user || '',
      smtp_from: settings.smtp_from || '',
      resend_api_key: '',
      smtp_pass: '',
    });
  }, [settings, form]);

  const saveMut = useMutation({
    mutationFn: updateEmailSettings,
    onSuccess: () => message.success('Email settings saved'),
    onError: (err) => message.error(err.response?.data?.error || 'Save failed'),
  });

  const handleTest = async () => {
    setTesting(true);
    try {
      const data = await testEmailSettings();
      message.success(data.message);
    } catch (err) {
      message.error(err.response?.data?.error || 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (values) => {
    saveMut.mutate(values);
  };

  if (isLoading) return <Skeleton active />;

  const labelStyle = { fontSize: 13 };

  return (
    <div style={{ maxWidth: 540 }}>
      <Form form={form} layout="vertical" onFinish={handleSave} disabled={!isAdmin}
        initialValues={{ provider: 'resend', smtp_port: 587 }}>

        <Form.Item name="provider" label={<span style={labelStyle}>Email provider</span>}>
          <Radio.Group onChange={(e) => setProvider(e.target.value)}>
            <Radio value="resend">Resend</Radio>
            <Radio value="smtp">Custom SMTP</Radio>
          </Radio.Group>
        </Form.Item>

        {provider === 'resend' && (
          <>
            <Form.Item
              name="resend_api_key"
              label={<span style={labelStyle}>Resend API key</span>}
              extra={settings?.resend_api_key_set ? 'Already configured — leave blank to keep current key' : 'Will fall back to RESEND_API_KEY env var if left blank'}
            >
              <Input.Password placeholder={settings?.resend_api_key_set ? '••••••••' : 're_xxxxxxxxxxxx'} autoComplete="off" />
            </Form.Item>
            <Form.Item
              name="resend_from_email"
              label={<span style={labelStyle}>From email</span>}
              extra="Falls back to RESEND_FROM_EMAIL env var if left blank"
            >
              <Input placeholder="alerts@yourdomain.com" />
            </Form.Item>
          </>
        )}

        {provider === 'smtp' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '0 12px' }}>
              <Form.Item name="smtp_host" label={<span style={labelStyle}>SMTP host</span>}
                rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="smtp.example.com" />
              </Form.Item>
              <Form.Item name="smtp_port" label={<span style={labelStyle}>Port</span>}>
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
              <Form.Item name="smtp_user" label={<span style={labelStyle}>Username</span>}>
                <Input placeholder="user@example.com" />
              </Form.Item>
              <Form.Item name="smtp_pass" label={<span style={labelStyle}>Password</span>}
                extra={settings?.smtp_pass_set ? 'Leave blank to keep current password' : undefined}>
                <Input.Password placeholder={settings?.smtp_pass_set ? '••••••••' : ''} autoComplete="new-password" />
              </Form.Item>
            </div>
            <Form.Item name="smtp_from" label={<span style={labelStyle}>From address</span>}
              rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder="alerts@yourcompany.com" />
            </Form.Item>
          </>
        )}

        {isAdmin && (
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <Button type="primary" htmlType="submit" loading={saveMut.isPending}>
              Save changes
            </Button>
            <Button icon={<SendOutlined />} onClick={handleTest} loading={testing}>
              Send test email
            </Button>
          </div>
        )}
      </Form>
    </div>
  );
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'organization';

  const items = [
    {
      key: 'organization',
      label: <span><BankOutlined /> Organization</span>,
      children: <OrganizationTab />,
    },
    {
      key: 'members',
      label: <span><TeamOutlined /> Members</span>,
      children: <MembersTab />,
    },
    {
      key: 'profile',
      label: <span><UserOutlined /> Profile</span>,
      children: <ProfileTab />,
    },
    {
      key: 'email',
      label: <span><MailOutlined /> Email</span>,
      children: <EmailTab />,
    },
  ];

  return (
    <div>
      <Text strong style={{ display: 'block', fontSize: 20, color: '#3e3b45', marginBottom: 12 }}>Settings</Text>
      <Tabs activeKey={activeTab} onChange={(key) => setSearchParams({ tab: key })} items={items} />
    </div>
  );
}
