'use client';

import AppLayout from '@/components/layout/AppLayout';
import { Empty, Button } from 'antd';
import { DollarCircleOutlined, PlusOutlined } from '@ant-design/icons';

export default function PaymentsPage() {
  return (
    <AppLayout pageTitle="บันทึกการชำระ">
      <div className="page-header">
        <h1 className="page-header-title">บันทึกการชำระเงิน</h1>
        <p className="page-header-subtitle">ประวัติการชำระและการตัดยอดดอกเบี้ย</p>
      </div>
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Empty
          image={<DollarCircleOutlined style={{ fontSize: 64, color: 'var(--color-success)' }} />}
          styles={{ image: { height: 80 } }}
          description={<span style={{ color: 'var(--color-text-muted)' }}>กำลังพัฒนา — Phase 3</span>}
        >
          <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 'var(--radius-md)' }}>
            บันทึกการชำระใหม่
          </Button>
        </Empty>
      </div>
    </AppLayout>
  );
}
