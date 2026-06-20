import { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      navigate('/dashboard');
    } catch (err) {
      message.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your LogHive workspace">
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item
          name="email"
          label="Email address"
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
          rules={[{ required: true, message: 'Please enter your password' }]}
          style={{ marginBottom: 8 }}
        >
          <Input.Password prefix={<LockOutlined style={{ color: '#b5b0bd' }} />} placeholder="Your password" autoComplete="current-password" />
        </Form.Item>

        <div style={{ textAlign: 'right', marginBottom: 16 }}>
          <Link to="/forgot-password" style={{ fontSize: 13, color: '#6c47ff' }}>
            Forgot password?
          </Link>
        </div>

        <Form.Item style={{ marginBottom: 16 }}>
          <Button type="primary" htmlType="submit" loading={loading} block style={{ height: 38, fontWeight: 600 }}>
            Sign in
          </Button>
        </Form.Item>

        <p style={{ textAlign: 'center', margin: 0, fontSize: 13, color: '#8c869a' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: '#6c47ff', fontWeight: 500 }}>
            Create one
          </Link>
        </p>
      </Form>
    </AuthLayout>
  );
}
