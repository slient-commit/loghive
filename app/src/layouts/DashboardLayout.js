import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Dropdown, Avatar, Typography } from 'antd';
import {
  DashboardOutlined,
  AppstoreOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { useAuth } from '../auth/AuthContext';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/dashboard',       icon: <DashboardOutlined />, label: 'Dashboard'     },
  { key: '/apps',            icon: <AppstoreOutlined />,  label: 'Applications'  },
  { key: '/notifications',   icon: <BellOutlined />,      label: 'Notifications' },
  { type: 'divider' },
  { key: '/settings',        icon: <SettingOutlined />,   label: 'Settings'      },
];

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: 'Profile', onClick: () => navigate('/settings?tab=profile') },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Sign out', danger: true, onClick: () => { logout(); navigate('/login'); } },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        style={{ background: '#1a1625', borderRight: '1px solid rgba(255,255,255,0.05)' }}
        width={230}
      >
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? 0 : '0 18px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'linear-gradient(135deg, #6c47ff, #ff45a8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            L
          </div>
          {!collapsed && (
            <Typography.Text strong style={{ color: '#e7e5ea', margin: '0 0 0 12px', fontSize: 16, letterSpacing: -0.3 }}>
              LogHive
            </Typography.Text>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[
        location.pathname.startsWith('/settings')      ? '/settings'      :
        location.pathname.startsWith('/notifications') ? '/notifications' :
        location.pathname
      ]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0, marginTop: 8 }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            height: 56,
            lineHeight: '56px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e4e2e8',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16, cursor: 'pointer', color: '#8c869a', transition: 'color 150ms' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#2b2833'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#8c869a'; }}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar size={30} style={{ background: '#6c47ff', fontSize: 13, fontWeight: 600 }}>
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </Avatar>
              <span style={{ fontSize: 13, color: '#5b5468', fontWeight: 500 }}>{user?.email}</span>
            </div>
          </Dropdown>
        </Header>

        <Content style={{ padding: 24, background: '#faf9fb', minHeight: 'calc(100vh - 56px)' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
