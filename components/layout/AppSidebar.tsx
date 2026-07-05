'use client';

import React, { useState, useEffect } from 'react';
import { Layout, Menu, Badge, Tooltip, Avatar } from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  FileTextOutlined,
  DollarOutlined,
  SettingOutlined,
  BankOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  BellOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';

const { Sider } = Layout;

interface AppSidebarProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function AppSidebar({
  collapsed,
  onCollapse,
  mobileOpen,
  onMobileClose,
}: AppSidebarProps) {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);
  const { user } = useUser();
  const isAdmin = user?.publicMetadata?.role !== 'debtor';

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const items: MenuProps['items'] = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: <Link href="/dashboard">{isAdmin ? 'ภาพรวม' : 'ภาพรวมสัญญาของฉัน'}</Link>,
    },
    ...(isAdmin ? [
      {
        key: '/dashboard/debtors',
        icon: <TeamOutlined />,
        label: <Link href="/dashboard/debtors">จัดการลูกหนี้</Link>,
      },
      {
        key: '/dashboard/loans',
        icon: <FileTextOutlined />,
        label: <Link href="/dashboard/loans">สัญญาเงินกู้</Link>,
      },
      {
        key: '/dashboard/payments',
        icon: <DollarOutlined />,
        label: <Link href="/dashboard/payments">บันทึกการชำระ</Link>,
      },
      {
        type: 'divider' as const,
      },
      {
        key: '/dashboard/export',
        icon: <FileExcelOutlined />,
        label: <Link href="/dashboard/export">ส่งออก Excel</Link>,
      },
      {
        key: '/dashboard/settings',
        icon: <SettingOutlined />,
        label: <Link href="/dashboard/settings">ตั้งค่าระบบ</Link>,
      },
    ] : [
      {
        key: '/dashboard/payments',
        icon: <DollarOutlined />,
        label: <Link href="/dashboard/payments">ประวัติการชำระของฉัน</Link>,
      },
    ])
  ];

  const selectedKey = items
    ?.filter((item) => item && 'key' in item)
    .map((item) => (item as { key: string }).key)
    .find((key) => pathname === key || pathname.startsWith(key + '/')) ?? '/dashboard';

  const siderStyle: React.CSSProperties = isMobile
    ? {
        position: 'fixed',
        left: mobileOpen ? 0 : -260,
        top: 0,
        height: '100vh',
        zIndex: 300,
        transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: mobileOpen ? 'var(--shadow-lg)' : 'none',
      }
    : {
        position: 'fixed',
        left: 0,
        top: 0,
        height: '100vh',
        zIndex: 200,
      };

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div className="sidebar-overlay active" onClick={onMobileClose} />
      )}

      <Sider
        width={256}
        collapsedWidth={isMobile ? 0 : 72}
        collapsed={!isMobile ? collapsed : false}
        collapsible={false}
        trigger={null}
        style={siderStyle}
        className="app-sidebar"
      >
        {/* Logo Area */}
        <div className="sidebar-logo-area">
          <div className="sidebar-logo-icon">
            <BankOutlined />
          </div>
          {(!collapsed || isMobile) && (
            <div className="sidebar-logo-text">
              <h2>SmartLoan</h2>
              <p>ระบบจัดการสินเชื่อ</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="sidebar-nav">
          {(!collapsed || isMobile) && (
            <div className="sidebar-section-label">เมนูหลัก</div>
          )}
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={items}
            inlineCollapsed={!isMobile && collapsed}
            style={{
              border: 'none',
              background: 'transparent',
            }}
          />
        </div>

        {/* Bottom area: collapse toggle (desktop only) */}
        {!isMobile && (
          <div
            style={{
              padding: '12px',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: collapsed ? 'center' : 'flex-end',
            }}
          >
            <Tooltip title={collapsed ? 'ขยายเมนู' : 'ย่อเมนู'} placement="right">
              <button
                onClick={() => onCollapse(!collapsed)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-text-secondary)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              </button>
            </Tooltip>
          </div>
        )}
      </Sider>
    </>
  );
}
