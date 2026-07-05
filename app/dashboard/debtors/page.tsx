'use client';

import AppLayout from '@/components/layout/AppLayout';
import { Empty, Button } from 'antd';
import { TeamOutlined, PlusOutlined } from '@ant-design/icons';

export default function DebtorsPage() {
  return (
    <AppLayout pageTitle="จัดการลูกหนี้">
      <div className="page-header">
        <h1 className="page-header-title">จัดการลูกหนี้</h1>
        <p className="page-header-subtitle">เพิ่ม แก้ไข และดูข้อมูลลูกหนี้ทั้งหมด</p>
      </div>
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Empty
          image={<TeamOutlined style={{ fontSize: 64, color: 'var(--color-primary)' }} />}
          styles={{ image: { height: 80 } }}
          description={<span style={{ color: 'var(--color-text-muted)' }}>กำลังพัฒนา — Phase 2</span>}
        >
          <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 'var(--radius-md)' }}>
            เพิ่มลูกหนี้ใหม่
          </Button>
        </Empty>
      </div>
    </AppLayout>
  );
}
