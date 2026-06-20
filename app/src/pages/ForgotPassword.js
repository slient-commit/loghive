import { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import { forgotPassword } from '../api/auth';

function SentView() {
  return (
    <AuthLayout title="Check your inbox" subtitle="We've sent you a password reset link">
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: '#f0ebff', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6c47ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <p style={{ color: '#52525b', fontSize: 13, lineHeight: 1.6, margin: '0 0 20px' }}>
          If an account with that email exists, you'll receive a reset link within a few minutes.
          Check your spam folder if you don't see it.
        </p>
        <Link to="/login">
          <Button type="primary" block style={{ height: 38, fontWeight: 600 }}>
            Back to sign in
          </Button>
        </Link>
      </div>
    </AuthLayout>
  );
}

export default function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await forgotPassword(values.email);
      setSent(true);
    } catch {
      message.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) return <SentView />;

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your email and we'll send you a reset link">
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item
          name="email"
          label="Email address"
          rules={[
            { required: true, message: 'Please enter your email' },
            { type: 'email', message: 'Invalid email address' },
          ]}
        >
          <Input prefix={<MailOutlined style={{ color: '#b5b0bd' }} />} placeholder="you@company.com" autoComplete="email" autoFocus />
        </Form.Item>

        <Form.Item style={{ marginBottom: 16 }}>
          <Button type="primary" htmlType="submit" loading={loading} block style={{ height: 38, fontWeight: 600 }}>
            Send reset link
          </Button>
        </Form.Item>

        <p style={{ textAlign: 'center', margin: 0, fontSize: 13, color: '#8c869a' }}>
          <Link to="/login" style={{ color: '#6c47ff', fontWeight: 500 }}>
            ← Back to sign in
          </Link>
        </p>
      </Form>
    </AuthLayout>
  );
}
