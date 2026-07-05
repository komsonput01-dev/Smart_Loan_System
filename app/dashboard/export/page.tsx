'use client';

import AppLayout from '@/components/layout/AppLayout';
import { Empty, Button } from 'antd';
import { FileExcelOutlined, DownloadOutlined } from '@ant-design/icons';

export default function ExportPage() {
  return (
    <AppLayout pageTitle="ส่งออก Excel">
      <div className="page-header">
        <h1 className="page-header-title">ส่งออกข้อมูล Excel</h1>
        <p className="page-header-subtitle">ดาวน์โหลดรายงานสรุปและ Raw Data สำหรับ Pivot Table</p>
      </div>
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Empty
          image={<FileExcelOutlined style={{ fontSize: 64, color: '#217346' }} />}
          styles={{ image: { height: 80 } }}
          description={<span style={{ color: 'var(--color-text-muted)' }}>กำลังพัฒนา — Phase 6</span>}
        >
          <Button icon={<DownloadOutlined />} style={{ borderRadius: 'var(--radius-md)' }} disabled>
            ดาวน์โหลด Excel
          </Button>
        </Empty>
      </div>
    </AppLayout>
  );
}
