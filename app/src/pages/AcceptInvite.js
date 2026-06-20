import { useState } from 'react';
import { Card, Form, Input, Button, message, Result } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import { acceptInvite } from '../api/auth';
import { useAuth } from '../auth/AuthContext';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login: setAuthState } = useAuth();

  if (!token) {
    return (
      <AuthLayout>
        <Card>
          <Result
            status="error"
            title="Invalid Invitation"
            subTitle="This invitation link is invalid or has expired."
            extra={<Link to="/login">Go to Sign In</Link>}
          />
        </Card>
      </AuthLayout>
    );
  }

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const data = await acceptInvite(token, values.password);
      localStorage.setItem('loghive_token', data.token);
      window.location.href = '/dashboard';
    } catch (err) {
      message.error(err.response?.data?.error || 'Invitation expired or already used.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <Card>
        <Form layout="vertical" onFinish={onFinish} size="large">
          <p style={{ color: '#6b7280', marginBottom: 16 }}>
            You've been invited to join a team on Log Hive. Set your password to get started.
          </p>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'Please choose a password' },
              { min: 8, message: 'Minimum 8 characters' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Choose a password" />
          </Form.Item>

          <Form.Item
            name="confirm"
            label="Confirm Password"
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
            <Input.Password prefix={<LockOutlined />} placeholder="Confirm password" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Set Password & Join
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </AuthLayout>
  );
}
