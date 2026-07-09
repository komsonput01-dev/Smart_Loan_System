'use client';

import React from 'react';
import { Layout, Avatar, Badge, Button, Dropdown, Tooltip, Typography, Popover } from 'antd';
import type { MenuProps } from 'antd';
import {
  MenuOutlined,
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  DownOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useUser, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

const { Header } = Layout;
const { Text } = Typography;

interface AppHeaderProps {
  sidebarCollapsed: boolean;
  onMobileMenuToggle: () => void;
  pageTitle?: string;
}

export default function AppHeader({
  sidebarCollapsed,
  onMobileMenuToggle,
  pageTitle = 'ภาพรวมระบบ',
}: AppHeaderProps) {
  const router = useRouter();
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();

  const now = new Date();
  const dateStr = now.toLocaleDateString('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') {
      signOut(() => router.push('/'));
    } else if (key === 'profile') {
      openUserProfile();
    }
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'จัดการบัญชีผู้ใช้',
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'ออกจากระบบ',
      danger: true,
    },
  ];

  const fullName = user?.fullName || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'ผู้ใช้งาน';
  
  let roleLabel = 'ลูกหนี้';
  if (user?.publicMetadata?.role === 'admin' || !user?.publicMetadata?.role) {
    roleLabel = 'ผู้ดูแลระบบ';
  } else if (user?.publicMetadata?.role === 'staff') {
    roleLabel = 'พนักงาน';
  }
  const initials = fullName.substring(0, 1).toUpperCase();

  return (
    <Header
      className="app-header"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        left: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 'var(--space-4)',
        paddingRight: 'var(--space-6)',
        background: 'var(--color-bg-white)',
        borderBottom: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        height: 'var(--header-height)',
      }}
    >
      {/* Left: Mobile menu + Page title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        {/* Mobile menu toggle */}
        <Button
          type="text"
          icon={<MenuOutlined />}
          onClick={onMobileMenuToggle}
          className="show-mobile-flex"
          style={{
            display: 'none',
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-secondary)',
          }}
        />

        {/* Page title */}
        <div className="hidden-mobile">
          <div
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-muted)',
              marginBottom: 2,
            }}
          >
            {dateStr}
          </div>
          <div
            style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              lineHeight: 1,
            }}
          >
            {pageTitle}
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="header-actions">
        {/* Refresh */}
        <Tooltip title="รีเฟรชข้อมูล">
          <Button
            type="text"
            icon={<ReloadOutlined />}
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={() => window.location.reload()}
          />
        </Tooltip>

        {/* Notifications */}
        <Popover
          content={
            <div style={{ maxWidth: 280, padding: '4px' }}>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>การแจ้งเตือนระบบ</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                📍 ฟีเจอร์นี้กำลังอยู่ระหว่างการพัฒนา ในอนาคตจะแสดงรายการแจ้งเตือน เช่น สัญญาที่ใกล้ครบกำหนด หรือลูกหนี้ค้างชำระ (Overdue) ตรงนี้ครับ
              </div>
            </div>
          }
          trigger="click"
          placement="bottomRight"
        >
          <Tooltip title="การแจ้งเตือน">
            <Badge dot color="var(--color-primary)">
              <Button
                type="text"
                icon={<BellOutlined />}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            </Badge>
          </Tooltip>
        </Popover>

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 24,
            background: 'var(--color-border)',
            margin: '0 4px',
          }}
        />

        {/* User menu */}
        <Dropdown
          menu={{ items: userMenuItems, onClick: handleMenuClick }}
          placement="bottomRight"
          trigger={['click']}
        >
          <div className="header-user-info" style={{ cursor: 'pointer' }}>
            <Avatar
              size={32}
              src={user?.imageUrl}
              style={{
                background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-medium))',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {initials}
            </Avatar>
            <div className="hidden-mobile" style={{ lineHeight: 1.3 }}>
              <div
                style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                }}
              >
                {fullName}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--color-text-muted)',
                }}
              >
                {roleLabel}
              </div>
            </div>
            <DownOutlined
              className="hidden-mobile"
              style={{ fontSize: 10, color: 'var(--color-text-muted)' }}
            />
          </div>
        </Dropdown>
      </div>
    </Header>
  );
}
