import { useEffect } from 'react';

const STYLE = `
  .auth-root {
    display: flex;
    min-height: 100vh;
    font-family: 'Rubik', system-ui, sans-serif;
  }
  .auth-brand {
    width: 400px;
    flex-shrink: 0;
    background: #0d0720;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 48px 44px;
    position: relative;
    overflow: hidden;
  }
  .auth-brand-dots {
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle, rgba(108,71,255,0.18) 1px, transparent 1px);
    background-size: 26px 26px;
    pointer-events: none;
  }
  .auth-brand-glow {
    position: absolute;
    bottom: -100px;
    right: -100px;
    width: 380px;
    height: 380px;
    background: radial-gradient(circle, rgba(108,71,255,0.22) 0%, transparent 65%);
    border-radius: 50%;
    pointer-events: none;
  }
  .auth-brand-glow2 {
    position: absolute;
    top: -60px;
    left: -60px;
    width: 240px;
    height: 240px;
    background: radial-gradient(circle, rgba(108,71,255,0.1) 0%, transparent 70%);
    border-radius: 50%;
    pointer-events: none;
  }
  .auth-panel {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 24px;
    background: #faf9fb;
  }
  .auth-panel-inner {
    width: 100%;
    max-width: 440px;
  }
  .auth-card {
    background: #ffffff;
    border-radius: 14px;
    padding: 28px 28px 24px;
    border: 1px solid #e4e2e8;
    box-shadow: 0 2px 20px rgba(0,0,0,0.05);
  }
  .auth-card .ant-form-item {
    margin-bottom: 12px;
  }
  .auth-card .ant-form-item-label {
    padding-bottom: 4px !important;
  }
  .auth-card .ant-form-item-label > label {
    font-size: 13px !important;
    font-weight: 500 !important;
    color: #4b4659 !important;
    height: auto !important;
  }
  .auth-card .ant-input,
  .auth-card .ant-input-password,
  .auth-card .ant-input-affix-wrapper {
    font-size: 14px !important;
    border-radius: 8px !important;
  }
  .auth-mobile-logo {
    display: none;
    align-items: center;
    gap: 10px;
    margin-bottom: 28px;
  }
  .auth-feature-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 18px;
  }
  .auth-feature-check {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(108,71,255,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 1px;
  }
  @media (max-width: 820px) {
    .auth-brand { display: none; }
    .auth-mobile-logo { display: flex; }
    .auth-panel { padding: 32px 16px; background: #faf9fb; }
    .auth-card { padding: 28px 22px; }
  }
  @media (max-width: 400px) {
    .auth-card { padding: 24px 16px; border-radius: 10px; }
  }
`;

const HexLogo = ({ size = 36, color = '#6c47ff' }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="LogHive">
    <path d="M18 2.5L31.124 10V26L18 33.5 4.876 26V10z" fill={color} />
    <path d="M12 15h7.5M12 18h10.5M12 21h5.5" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" />
  </svg>
);

function FeatureItem({ text }) {
  return (
    <div className="auth-feature-item">
      <div className="auth-feature-check">
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 6.5l2.5 2.5 5.5-5.5" stroke="#6c47ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <span style={{ color: 'rgba(255,255,255,0.62)', fontSize: 14, lineHeight: 1.55 }}>{text}</span>
    </div>
  );
}

export default function AuthLayout({ children, title, subtitle }) {
  useEffect(() => {
    if (!document.getElementById('auth-ui-styles')) {
      const el = document.createElement('style');
      el.id = 'auth-ui-styles';
      el.textContent = STYLE;
      document.head.appendChild(el);
    }
    return () => document.getElementById('auth-ui-styles')?.remove();
  }, []);

  return (
    <div className="auth-root">
      {/* ── Brand panel ── */}
      <aside className="auth-brand" role="complementary" aria-label="LogHive branding">
        <div className="auth-brand-dots" aria-hidden="true" />
        <div className="auth-brand-glow" aria-hidden="true" />
        <div className="auth-brand-glow2" aria-hidden="true" />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 56 }}>
            <HexLogo size={42} />
            <span style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.025em', fontFamily: 'Rubik, sans-serif' }}>
              LogHive
            </span>
          </div>

          {/* Tagline */}
          <h2 style={{ color: '#fff', fontSize: 26, fontWeight: 700, lineHeight: 1.25, margin: '0 0 12px', letterSpacing: '-0.03em', fontFamily: 'Rubik, sans-serif' }}>
            Your logs.<br />Your server.<br />Your rules.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.65, margin: '0 0 36px' }}>
            Self-hosted log monitoring with real-time dashboards, smart alerts, and SDKs for every stack.
          </p>

          {/* Feature list */}
          <FeatureItem text="Ingest logs from Node.js, Python &amp; .NET" />
          <FeatureItem text="Real-time dashboards with error spike detection" />
          <FeatureItem text="Scheduled email digests via Resend or SMTP" />
          <FeatureItem text="Multi-app, multi-user with role-based access" />
        </div>

        {/* Footer */}
        <div style={{ position: 'relative', zIndex: 1, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 20 }}>
          <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 12, margin: 0 }}>
            Source-Available · Non-Commercial · Self-hosted
          </p>
        </div>
      </aside>

      {/* ── Form panel ── */}
      <main className="auth-panel">
        <div className="auth-panel-inner">
          {/* Mobile logo */}
          <div className="auth-mobile-logo" aria-hidden="true">
            <HexLogo size={30} />
            <span style={{ fontSize: 17, fontWeight: 700, color: '#2b2833', letterSpacing: '-0.02em' }}>LogHive</span>
          </div>

          {/* Page title */}
          {title && (
            <div style={{ marginBottom: 18 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#2b2833', margin: 0, letterSpacing: '-0.02em', fontFamily: 'Rubik, sans-serif' }}>
                {title}
              </h1>
              {subtitle && (
                <p style={{ color: '#8c869a', fontSize: 13, margin: '4px 0 0', lineHeight: 1.4 }}>{subtitle}</p>
              )}
            </div>
          )}

          {/* Form card */}
          <div className="auth-card">{children}</div>
        </div>
      </main>
    </div>
  );
}
