'use client';

import React, { useState, useEffect } from 'react';
import { Layout } from 'antd';
import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';

const { Content } = Layout;

interface AppLayoutProps {
  children: React.ReactNode;
  pageTitle?: string;
}

export default function AppLayout({ children, pageTitle }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      setIsMobile(w < 768);
      setIsTablet(w >= 768 && w < 1024);
      // Auto-collapse on tablet
      if (w >= 768 && w < 1024) {
        setSidebarCollapsed(true);
      } else if (w >= 1024) {
        setSidebarCollapsed(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile menu on navigation
  const handleMobileClose = () => setMobileMenuOpen(false);

  const sidebarWidth = isMobile ? 0 : sidebarCollapsed ? 72 : 256;

  return (
    <Layout style={{ minHeight: '100vh', background: 'var(--color-bg-base)' }}>
      {/* Sidebar */}
      <AppSidebar
        collapsed={sidebarCollapsed}
        onCollapse={setSidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        onMobileClose={handleMobileClose}
      />

      {/* Main area */}
      <Layout
        style={{
          marginLeft: isMobile ? 0 : sidebarWidth,
          transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          background: 'var(--color-bg-base)',
        }}
      >
        {/* Fixed Header */}
        <AppHeader
          sidebarCollapsed={sidebarCollapsed}
          onMobileMenuToggle={() => setMobileMenuOpen((prev) => !prev)}
          pageTitle={pageTitle}
        />

        {/* Content */}
        <Content
          style={{
            minHeight: '100vh',
            padding: 0,
            background: 'var(--color-bg-base)',
          }}
        >
          <div className="page-container">{children}</div>
        </Content>
      </Layout>
    </Layout>
  );
}
