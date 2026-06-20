import { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { MailOutlined, LockOutlined, BankOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import { useAuth } from '../auth/AuthContext';

export default function Register() {
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await register(values);
      navigate('/check-email', { state: { email: values.email } });
    } catch (err) {
      message.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Set up your organization and start monitoring logs">
      <Form layout="vertical" onFinish={onFinish}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Form.Item
            name="first_name"
            label="First name"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input prefix={<UserOutlined style={{ color: '#b5b0bd' }} />} placeholder="Jane" autoComplete="given-name" />
          </Form.Item>

          <Form.Item
            name="last_name"
            label="Last name"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input prefix={<UserOutlined style={{ color: '#b5b0bd' }} />} placeholder="Doe" autoComplete="family-name" />
          </Form.Item>
        </div>

        <Form.Item
          name="organization_name"
          label="Organization name"
          rules={[{ required: true, message: 'Please enter your organization name' }]}
        >
          <Input prefix={<BankOutlined style={{ color: '#b5b0bd' }} />} placeholder="Acme Corp" />
        </Form.Item>

        <Form.Item
          name="email"
          label="Work email"
          rules={[
            { required: true, message: 'Please enter your email' },
            { type: 'email', message: 'Invalid email address' },
          ]}
        >
          <Input prefix={<MailOutlined style={{ color: '#b5b0bd' }} />} placeholder="you@company.com" autoComplete="email" />
        </Form.Item>

        <Form.Item
          name="password"
          label="Password"
          rules={[
            { required: true, message: 'Please enter a password' },
            { min: 8, message: 'Minimum 8 characters' },
          ]}
        >
          <Input.Password prefix={<LockOutlined style={{ color: '#b5b0bd' }} />} placeholder="Min 8 characters" autoComplete="new-password" />
        </Form.Item>

        <Form.Item
          name="confirm"
          label="Confirm password"
          dependencies={['password']}
          rules={[
            { required: true, message: 'Please confirm your password' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) return Promise.resolve();
                return Promise.reject(new Error('Passwords do not match'));
              },
            }),
          ]}
        >
          <Input.Password prefix={<LockOutlined style={{ color: '#b5b0bd' }} />} placeholder="Repeat password" autoComplete="new-password" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 16, marginTop: 4 }}>
          <Button type="primary" htmlType="submit" loading={loading} block style={{ height: 38, fontWeight: 600 }}>
            Create account
          </Button>
        </Form.Item>

        <p style={{ textAlign: 'center', margin: 0, fontSize: 13, color: '#8c869a' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#6c47ff', fontWeight: 500 }}>
            Sign in
          </Link>
        </p>
      </Form>
    </AuthLayout>
  );
}
