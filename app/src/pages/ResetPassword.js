import { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { Link, useSearchParams } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import { resetPassword } from '../api/auth';

function InvalidLinkView() {
  return (
    <AuthLayout title="Link expired" subtitle="This password reset link is invalid or has expired">
      <div style={{ textAlign: 'center', padding: '12px 0' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: '#fef2f2', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p style={{ color: '#52525b', fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
          Request a new reset link and try again.
        </p>
        <Link to="/forgot-password">
          <Button type="primary" block style={{ height: 42, fontWeight: 600 }}>
            Request new link
          </Button>
        </Link>
      </div>
    </AuthLayout>
  );
}

function DoneView() {
  return (
    <AuthLayout title="Password updated" subtitle="Your new password is ready to use">
      <div style={{ textAlign: 'center', padding: '12px 0' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: '#f0fdf4', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <p style={{ color: '#52525b', fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
          Your password has been updated successfully. You can now sign in with your new password.
        </p>
        <Link to="/login">
          <Button type="primary" block style={{ height: 42, fontWeight: 600 }}>
            Sign in
          </Button>
        </Link>
      </div>
    </AuthLayout>
  );
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) return <InvalidLinkView />;
  if (done) return <DoneView />;

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await resetPassword(token, values.password);
      setDone(true);
    } catch (err) {
      message.error(err.response?.data?.error || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Choose a new password" subtitle="Must be at least 8 characters">
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item
          name="password"
          label="New password"
          rules={[
            { required: true, message: 'Please enter a new password' },
            { min: 8, message: 'Minimum 8 characters' },
          ]}
        >
          <Input.Password prefix={<LockOutlined style={{ color: '#b5b0bd' }} />} placeholder="Min 8 characters" autoComplete="new-password" autoFocus />
        </Form.Item>

        <Form.Item
          name="confirm"
          label="Confirm new password"
          dependencies={['password']}
          style={{ marginBottom: 20 }}
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

        <Form.Item style={{ marginBottom: 0, marginTop: 4 }}>
          <Button type="primary" htmlType="submit" loading={loading} block style={{ height: 38, fontWeight: 600 }}>
            Reset password
          </Button>
        </Form.Item>
      </Form>
    </AuthLayout>
  );
}
