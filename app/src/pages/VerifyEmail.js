import { useEffect, useState } from 'react';
import { Card, Result, Button, Spin } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useSearchParams, useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import { verifyEmail } from '../api/auth';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('No verification token provided');
      return;
    }

    verifyEmail(token)
      .then((data) => {
        localStorage.setItem('loghive_token', data.token);
        setStatus('success');
      })
      .catch((err) => {
        setStatus('error');
        setError(err.response?.data?.error || 'Verification failed');
      });
  }, [token]);

  if (status === 'loading') {
    return (
      <AuthLayout>
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
          <p style={{ marginTop: 16 }}>Verifying your email...</p>
        </Card>
      </AuthLayout>
    );
  }

  if (status === 'success') {
    return (
      <AuthLayout>
        <Card>
          <Result
            icon={<CheckCircleOutlined style={{ color: '#16a34a' }} />}
            title="Email verified!"
            subTitle="Your account is now active. You can start using LogHive."
            extra={
              <Button type="primary" onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            }
          />
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Card>
        <Result
          icon={<CloseCircleOutlined style={{ color: '#dc2626' }} />}
          title="Verification failed"
          subTitle={error}
          extra={
            <Button type="primary" onClick={() => navigate('/login')}>
              Go to Login
            </Button>
          }
        />
      </Card>
    </AuthLayout>
  );
}
