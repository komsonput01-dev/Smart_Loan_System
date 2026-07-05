'use client';

import AppLayout from '@/components/layout/AppLayout';
import { Empty, Button } from 'antd';
import { SettingOutlined } from '@ant-design/icons';

export default function SettingsPage() {
  return (
    <AppLayout pageTitle="ตั้งค่าระบบ">
      <div className="page-header">
        <h1 className="page-header-title">ตั้งค่าระบบ</h1>
        <p className="page-header-subtitle">กำหนดค่าระบบ LINE Notification, บัญชีธนาคาร และสิทธิ์ผู้ใช้</p>
      </div>
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Empty
          image={<SettingOutlined style={{ fontSize: 64, color: 'var(--color-text-muted)' }} />}
          styles={{ image: { height: 80 } }}
          description={<span style={{ color: 'var(--color-text-muted)' }}>กำลังพัฒนา — Phase 5</span>}
        />
      </div>
    </AppLayout>
  );
}
