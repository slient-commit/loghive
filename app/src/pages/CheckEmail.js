import { useState } from 'react';
import { Card, Button, message, Result } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import { useLocation, Link } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import { resendVerification } from '../api/auth';

export default function CheckEmail() {
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const email = location.state?.email;

  const handleResend = async () => {
    if (!email) return;
    setLoading(true);
    try {
      await resendVerification(email);
      message.success('Verification email resent');
    } catch {
      message.error('Failed to resend email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <Card>
        <Result
          icon={<MailOutlined style={{ color: '#1d4ed8' }} />}
          title="Check your email"
          subTitle={
            email
              ? `We sent a verification link to ${email}. Click the link to activate your account.`
              : 'We sent a verification link to your email. Click the link to activate your account.'
          }
          extra={[
            <Button key="resend" onClick={handleResend} loading={loading} disabled={!email}>
              Resend email
            </Button>,
            <Link key="login" to="/login">
              <Button type="primary">Go to Login</Button>
            </Link>,
          ]}
        />
      </Card>
    </AuthLayout>
  );
}
