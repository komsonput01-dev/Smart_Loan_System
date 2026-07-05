'use client';

import AppLayout from '@/components/layout/AppLayout';
import { Empty, Button } from 'antd';
import { FileTextOutlined, PlusOutlined } from '@ant-design/icons';

export default function LoansPage() {
  return (
    <AppLayout pageTitle="สัญญาเงินกู้">
      <div className="page-header">
        <h1 className="page-header-title">สัญญาเงินกู้</h1>
        <p className="page-header-subtitle">รายการสัญญาและรายละเอียดการกู้ทั้งหมด</p>
      </div>
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Empty
          image={<FileTextOutlined style={{ fontSize: 64, color: 'var(--color-primary)' }} />}
          styles={{ image: { height: 80 } }}
          description={<span style={{ color: 'var(--color-text-muted)' }}>กำลังพัฒนา — Phase 2</span>}
        >
          <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 'var(--radius-md)' }}>
            สร้างสัญญาใหม่
          </Button>
        </Empty>
      </div>
    </AppLayout>
  );
}
